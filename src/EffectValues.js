const ACTIVE_EFFECT_MODE = Object.freeze({
  CUSTOM: 0,
  MULTIPLY: 1,
  ADD: 2,
  OVERRIDE: 5
});

const SYSTEM_PROPS_PREFIX = "system.props.";
const PROPS_PREFIX = "props.";
const FORMULA_START = "${";
const FORMULA_END = "}$";
const NUMERIC_TEXT = /^-?(?:\d+|\d*\.\d+)$/;

export function trimEffectText(value) {
  return String(value ?? "").trim();
}

export function isCSBPropPath(value) {
  const text = trimEffectText(value);
  return text.startsWith(SYSTEM_PROPS_PREFIX) || text.startsWith(PROPS_PREFIX);
}

export function isCSBEffectKey(value) {
  return isCSBPropPath(value);
}

export function unwrapCSBFormula(value) {
  const text = trimEffectText(value);
  if (text.startsWith(FORMULA_START) && text.endsWith(FORMULA_END)) return text.slice(FORMULA_START.length, -FORMULA_END.length).trim();
  return "";
}

export function csbPathExpression(value) {
  const text = trimEffectText(value);
  if (text.startsWith(SYSTEM_PROPS_PREFIX)) return text.slice(SYSTEM_PROPS_PREFIX.length);
  if (text.startsWith(PROPS_PREFIX)) return text.slice(PROPS_PREFIX.length);
  return "";
}

export function csbValueExpression(value) {
  const text = trimEffectText(value);
  if (!text) return "";
  const formula = unwrapCSBFormula(text);
  if (formula) return formula;
  if (isCSBPropPath(text)) return csbPathExpression(text);
  if (NUMERIC_TEXT.test(text)) return text;
  return "";
}

export function makeCSBFormula(expression) {
  return FORMULA_START + " " + expression + " " + FORMULA_END;
}

export function normalizeEffectChange(change) {
  const mode = Number(change?.mode ?? ACTIVE_EFFECT_MODE.CUSTOM);
  const normalized = { ...change, mode, value: trimEffectText(change?.value) };
  const expression = csbValueExpression(normalized.value);
  if (isCSBEffectKey(normalized.key) && expression) {
    if (mode === ACTIVE_EFFECT_MODE.ADD) {
      return { ...normalized, mode: ACTIVE_EFFECT_MODE.CUSTOM, value: makeCSBFormula(`current + (${expression})`) };
    }
    if (mode === ACTIVE_EFFECT_MODE.MULTIPLY) {
      return { ...normalized, mode: ACTIVE_EFFECT_MODE.CUSTOM, value: makeCSBFormula(`current * (${expression})`) };
    }
    if (mode === ACTIVE_EFFECT_MODE.OVERRIDE) {
      return { ...normalized, mode: ACTIVE_EFFECT_MODE.CUSTOM, value: makeCSBFormula(expression) };
    }
  }
  if (isCSBPropPath(normalized.value)) return { ...normalized, value: makeCSBFormula(csbPathExpression(normalized.value)) };
  return normalized;
}

export function normalizeEffectChanges(changes) {
  if (!Array.isArray(changes)) return [];
  return changes.map(normalizeEffectChange);
}
