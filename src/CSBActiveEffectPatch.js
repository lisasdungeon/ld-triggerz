import { unwrapCSBFormula } from "./EffectValues.js";

export function formulaUsesCurrentToken(phrase) {
  const text = String(phrase ?? "");
  const inner = unwrapCSBFormula(text) || text;
  return /(^|[^A-Za-z0-9_])current([^A-Za-z0-9_]|$)/.test(inner);
}

export function shouldPreserveCurrentFormula(phrase, props) {
  if (!formulaUsesCurrentToken(phrase)) return false;
  if (!props || typeof props !== "object") return true;
  return !Object.prototype.hasOwnProperty.call(props, "current");
}

export function patchComputablePhraseForCurrent(env = globalThis) {
  const phraseClass = env.ComputablePhrase;
  if (!phraseClass || typeof phraseClass.computeMessageStatic !== "function") return false;
  if (phraseClass.computeMessageStatic.__ldTriggerzPatched) return true;

  const original = phraseClass.computeMessageStatic.bind(phraseClass);

  function patchedComputeMessageStatic(phrase, props, options) {
    const text = String(phrase ?? "");
    if (shouldPreserveCurrentFormula(text, props)) {
      return { result: text };
    }
    return original(phrase, props, options);
  }

  patchedComputeMessageStatic.__ldTriggerzPatched = true;
  phraseClass.computeMessageStatic = patchedComputeMessageStatic;
  return true;
}
