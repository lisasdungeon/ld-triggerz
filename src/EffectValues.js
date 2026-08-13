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
const LEGACY_ADD_FORMULA = /^current\s*\+\s*\((.+)\)$/;
const LEGACY_MULTIPLY_FORMULA = /^current\s*\*\s*\((.+)\)$/;

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

function restoreLegacyCSBMath(change) {
  if (Number(change.mode) !== ACTIVE_EFFECT_MODE.CUSTOM || !isCSBEffectKey(change.key)) return null;
  const formula = unwrapCSBFormula(change.value);
  if (!formula) return null;

  const addMatch = formula.match(LEGACY_ADD_FORMULA);
  if (addMatch) {
    const value = trimEffectText(addMatch[1]);
    if (value) return { ...change, mode: ACTIVE_EFFECT_MODE.ADD, value };
  }

  const multiplyMatch = formula.match(LEGACY_MULTIPLY_FORMULA);
  if (multiplyMatch) {
    const value = trimEffectText(multiplyMatch[1]);
    if (value) return { ...change, mode: ACTIVE_EFFECT_MODE.MULTIPLY, value };
  }

  // Prior OVERRIDE conversion was CUSTOM with a bare numeric formula.
  if (NUMERIC_TEXT.test(formula)) {
    return { ...change, mode: ACTIVE_EFFECT_MODE.OVERRIDE, value: formula };
  }

  return null;
}

export function normalizeEffectChange(change) {
  const mode = Number(change?.mode ?? ACTIVE_EFFECT_MODE.CUSTOM);
  const normalized = { ...change, mode, value: trimEffectText(change?.value) };
  const restored = restoreLegacyCSBMath(normalized);
  if (restored) return restored;

  // CSB prepareData applies ADD/MULTIPLY/OVERRIDE through Foundry applyChange.
  // CUSTOM formulas that use `current` are expanded earlier in computeEffectChanges
  // without a `current` binding, so those changes are dropped. Keep native modes.
  if (isCSBPropPath(normalized.value)) {
    return { ...normalized, value: makeCSBFormula(csbPathExpression(normalized.value)) };
  }
  return normalized;
}

export function normalizeEffectChanges(changes) {
  if (!Array.isArray(changes)) return [];
  return changes.map(normalizeEffectChange);
}
