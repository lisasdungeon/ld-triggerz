import { unwrapCSBFormula } from "./EffectValues.js";
import { errorLog } from "./Logger.js";

const ACTIVE_EFFECT_MODE = Object.freeze({
  CUSTOM: 0,
  MULTIPLY: 1,
  ADD: 2
});

const SYSTEM_PROPS_PREFIX = "system.props.";

export function isCSBSystemPropKey(key) {
  return String(key ?? "").startsWith(SYSTEM_PROPS_PREFIX);
}

export function isCSBFormulaText(value) {
  const text = String(value ?? "").trim();
  return Boolean(unwrapCSBFormula(text));
}

export function toFiniteNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const text = String(value ?? "").trim();
  if (!text) return NaN;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : NaN;
}

export function resolveEffectDeltaAmount(targetDoc, change, delta, env = globalThis) {
  const deltaNumber = toFiniteNumber(delta);
  if (Number.isFinite(deltaNumber)) return deltaNumber;

  const valueNumber = toFiniteNumber(change?.value);
  if (Number.isFinite(valueNumber)) return valueNumber;

  const formula = String(change?.value ?? "").trim();
  if (!isCSBFormulaText(formula) || typeof env.ComputablePhrase?.computeMessageStatic !== "function") return NaN;

  try {
    const props = {
      ...(targetDoc?.system?.props ?? {})
    };
    const result = env.ComputablePhrase.computeMessageStatic(formula, props, {
      source: "ld-triggerz.activeEffect.delta",
      triggerEntity: targetDoc?.templateSystem,
      suppressErrorLogs: true
    }).result;
    return toFiniteNumber(result);
  } catch {
    return NaN;
  }
}

export function applyNumericCSBPropChange(targetDoc, change, current, delta, changes, env = globalThis) {
  if (!change || !changes || !isCSBSystemPropKey(change.key)) return false;
  const mode = Number(change.mode);
  if (mode !== ACTIVE_EFFECT_MODE.ADD && mode !== ACTIVE_EFFECT_MODE.MULTIPLY) return false;

  const currentNumber = toFiniteNumber(current);
  const amount = resolveEffectDeltaAmount(targetDoc, change, delta, env);
  if (isCSBFormulaText(change.value) && !Number.isFinite(amount)) {
    return errorLog(env, `Uncomputable active effect delta for ${change.key}: ${change.value}`);
  }
  if (!Number.isFinite(currentNumber) || !Number.isFinite(amount)) return false;

  changes[change.key] = mode === ACTIVE_EFFECT_MODE.ADD ? currentNumber + amount : currentNumber * amount;
  return true;
}

function patchStaticApplyMethod(effectClass, methodName, mode, env) {
  if (typeof effectClass[methodName] !== "function") return false;
  if (effectClass[methodName].__ldTriggerzPatched) return true;

  const original = effectClass[methodName].bind(effectClass);
  function patched(targetDoc, change, current, delta, changes) {
    const typedChange = { ...change, mode };
    if (applyNumericCSBPropChange(targetDoc, typedChange, current, delta, changes, env)) return;
    return original(targetDoc, change, current, delta, changes);
  }
  patched.__ldTriggerzPatched = true;
  effectClass[methodName] = patched;
  return true;
}

export function patchCSBNumericPropEffectApply(env = globalThis) {
  const effectClass = env.CONFIG?.ActiveEffect?.documentClass;
  if (!effectClass) return false;

  const patchedAdd = patchStaticApplyMethod(effectClass, "_applyChangeAdd", ACTIVE_EFFECT_MODE.ADD, env);
  const patchedMultiply = patchStaticApplyMethod(effectClass, "_applyChangeMultiply", ACTIVE_EFFECT_MODE.MULTIPLY, env);
  return patchedAdd || patchedMultiply;
}

export function patchComputablePhrasePreserveActiveEffectFormulas(env = globalThis) {
  const phraseClass = env.ComputablePhrase;
  if (!phraseClass || typeof phraseClass.computeMessageStatic !== "function") return false;
  if (phraseClass.computeMessageStatic.__ldTriggerzPreservePatched) return true;

  const original = phraseClass.computeMessageStatic.bind(phraseClass);
  function patched(phrase, props, options = {}) {
    try {
      return original(phrase, props, options);
    } catch (error) {
      const source = String(options?.source ?? "");
      const text = String(phrase ?? "");
      if (source.includes("activeEffect.") && source.endsWith(".value") && isCSBFormulaText(text)) {
        return { result: text };
      }
      throw error;
    }
  }
  patched.__ldTriggerzPreservePatched = true;
  phraseClass.computeMessageStatic = patched;
  return true;
}

export function registerCSBNumericPropEffectHook(env = globalThis) {
  if (!env.Hooks?.on) return false;
  if (env.Hooks.__ldTriggerzCSBNumericPropHook) return true;
  env.Hooks.on("applyActiveEffect", (document, change, current, delta, changes) => {
    applyNumericCSBPropChange(document, change, current, delta, changes, env);
  });
  env.Hooks.__ldTriggerzCSBNumericPropHook = true;
  return true;
}

export function installCSBNumericPropEffectSupport(env = globalThis) {
  const preserved = patchComputablePhrasePreserveActiveEffectFormulas(env);
  const patched = patchCSBNumericPropEffectApply(env);
  const hooked = registerCSBNumericPropEffectHook(env);
  return preserved || patched || hooked;
}
