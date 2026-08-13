const ACTIVE_EFFECT_MODE = Object.freeze({
  CUSTOM: 0,
  MULTIPLY: 1,
  ADD: 2
});

const SYSTEM_PROPS_PREFIX = "system.props.";

export function isCSBSystemPropKey(key) {
  return String(key ?? "").startsWith(SYSTEM_PROPS_PREFIX);
}

export function toFiniteNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const text = String(value ?? "").trim();
  if (!text) return NaN;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : NaN;
}

export function applyNumericCSBPropChange(_document, change, current, delta, changes) {
  if (!change || !changes || !isCSBSystemPropKey(change.key)) return false;
  const mode = Number(change.mode);
  if (mode !== ACTIVE_EFFECT_MODE.ADD && mode !== ACTIVE_EFFECT_MODE.MULTIPLY) return false;

  const currentNumber = toFiniteNumber(current);
  const deltaNumber = toFiniteNumber(delta);
  const valueNumber = toFiniteNumber(change.value);
  const amount = Number.isFinite(deltaNumber) ? deltaNumber : valueNumber;
  if (!Number.isFinite(currentNumber) || !Number.isFinite(amount)) return false;

  changes[change.key] = mode === ACTIVE_EFFECT_MODE.ADD ? currentNumber + amount : currentNumber * amount;
  return true;
}

function patchStaticApplyMethod(effectClass, methodName, mode) {
  if (typeof effectClass[methodName] !== "function") return false;
  if (effectClass[methodName].__ldTriggerzPatched) return true;

  const original = effectClass[methodName].bind(effectClass);
  function patched(targetDoc, change, current, delta, changes) {
    const typedChange = { ...change, mode };
    if (applyNumericCSBPropChange(targetDoc, typedChange, current, delta, changes)) return;
    return original(targetDoc, change, current, delta, changes);
  }
  patched.__ldTriggerzPatched = true;
  effectClass[methodName] = patched;
  return true;
}

export function patchCSBNumericPropEffectApply(env = globalThis) {
  const effectClass = env.CONFIG?.ActiveEffect?.documentClass;
  if (!effectClass) return false;

  const patchedAdd = patchStaticApplyMethod(effectClass, "_applyChangeAdd", ACTIVE_EFFECT_MODE.ADD);
  const patchedMultiply = patchStaticApplyMethod(effectClass, "_applyChangeMultiply", ACTIVE_EFFECT_MODE.MULTIPLY);
  return patchedAdd || patchedMultiply;
}

// Kept for older Foundry paths where only CUSTOM fired applyActiveEffect.
export function registerCSBNumericPropEffectHook(env = globalThis) {
  if (!env.Hooks?.on) return false;
  if (env.Hooks.__ldTriggerzCSBNumericPropHook) return true;
  env.Hooks.on("applyActiveEffect", (document, change, current, delta, changes) => {
    applyNumericCSBPropChange(document, change, current, delta, changes);
  });
  env.Hooks.__ldTriggerzCSBNumericPropHook = true;
  return true;
}

export function installCSBNumericPropEffectSupport(env = globalThis) {
  const patched = patchCSBNumericPropEffectApply(env);
  const hooked = registerCSBNumericPropEffectHook(env);
  return patched || hooked;
}
