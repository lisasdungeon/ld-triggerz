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
const PROP_ADD_FORMULA = /^([A-Za-z_][A-Za-z0-9_]*)\s*\+\s*\((.+)\)$/;
const PROP_MULTIPLY_FORMULA = /^([A-Za-z_][A-Za-z0-9_]*)\s*\*\s*\((.+)\)$/;

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

function extractLegacyDelta(change) {
  if (Number(change.mode) !== ACTIVE_EFFECT_MODE.CUSTOM || !isCSBEffectKey(change.key)) return null;
  const formula = unwrapCSBFormula(change.value);
  if (!formula) return null;
  const propKey = csbPathExpression(change.key);

  const currentAdd = formula.match(LEGACY_ADD_FORMULA);
  if (currentAdd) {
    const value = trimEffectText(currentAdd[1]);
    if (value) return { mode: ACTIVE_EFFECT_MODE.ADD, value };
  }

  const currentMultiply = formula.match(LEGACY_MULTIPLY_FORMULA);
  if (currentMultiply) {
    const value = trimEffectText(currentMultiply[1]);
    if (value) return { mode: ACTIVE_EFFECT_MODE.MULTIPLY, value };
  }

  const propAdd = formula.match(PROP_ADD_FORMULA);
  if (propAdd && propAdd[1] === propKey) {
    const value = trimEffectText(propAdd[2]);
    if (value) return { mode: ACTIVE_EFFECT_MODE.ADD, value };
  }

  const propMultiply = formula.match(PROP_MULTIPLY_FORMULA);
  if (propMultiply && propMultiply[1] === propKey) {
    const value = trimEffectText(propMultiply[2]);
    if (value) return { mode: ACTIVE_EFFECT_MODE.MULTIPLY, value };
  }

  if (NUMERIC_TEXT.test(formula)) {
    return { mode: ACTIVE_EFFECT_MODE.OVERRIDE, value: formula };
  }

  return null;
}

export function normalizeEffectChange(change) {
  const initialMode = Number(change?.mode ?? ACTIVE_EFFECT_MODE.CUSTOM);
  let normalized = { ...change, mode: initialMode, value: trimEffectText(change?.value) };

  // Foundry ADD concatenates when CSB props are strings ("1" + "-0.1" => "1-0.1").
  // CSB Custom formulas are evaluated with mathjs, which does real numeric math.
  // Use the component key (not `current`) so computeEffectChanges can resolve it.
  if (isCSBEffectKey(normalized.key)) {
    const legacy = extractLegacyDelta(normalized);
    const mode = legacy?.mode ?? normalized.mode;
    const value = legacy?.value ?? normalized.value;
    const propKey = csbPathExpression(normalized.key);
    const expression = csbValueExpression(value) || (NUMERIC_TEXT.test(value) ? value : "");

    if (mode === ACTIVE_EFFECT_MODE.ADD && expression && propKey) {
      return { ...normalized, mode: ACTIVE_EFFECT_MODE.CUSTOM, value: makeCSBFormula(`${propKey} + (${expression})`) };
    }
    if (mode === ACTIVE_EFFECT_MODE.MULTIPLY && expression && propKey) {
      return { ...normalized, mode: ACTIVE_EFFECT_MODE.CUSTOM, value: makeCSBFormula(`${propKey} * (${expression})`) };
    }
    if (legacy?.mode === ACTIVE_EFFECT_MODE.OVERRIDE) {
      return { ...normalized, mode: ACTIVE_EFFECT_MODE.OVERRIDE, value: legacy.value };
    }
    normalized = { ...normalized, mode, value };
  }

  if (isCSBPropPath(normalized.value)) {
    return { ...normalized, value: makeCSBFormula(csbPathExpression(normalized.value)) };
  }
  return normalized;
}

export function normalizeEffectChanges(changes) {
  if (!Array.isArray(changes)) return [];
  return changes.map(normalizeEffectChange);
}
