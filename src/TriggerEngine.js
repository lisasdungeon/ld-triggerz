import { ACTION_TYPES, OPERATORS } from "./constants.js";
import { asArray, getProperty, hasProperty, makeError } from "./utils.js";

export const COMPARATORS = Object.freeze({
  [OPERATORS.EQ]: (left, right) => left === right,
  [OPERATORS.NE]: (left, right) => left !== right,
  [OPERATORS.LT]: (left, right) => left < right,
  [OPERATORS.LTE]: (left, right) => left <= right,
  [OPERATORS.GT]: (left, right) => left > right,
  [OPERATORS.GTE]: (left, right) => left >= right
});

export function isNumericValue(value) {
  if (value === "" || value === null || value === undefined) return false;
  return Number.isFinite(Number(value));
}

export function comparableValues(left, right) {
  if (isNumericValue(left) && isNumericValue(right)) return [Number(left), Number(right)];
  return [left, right];
}

export function compareValues(operator, left, right) {
  return COMPARATORS[operator](...comparableValues(left, right));
}

export function coerceValue(value, exemplar) {
  if (typeof exemplar === "number") return Number(value);
  if (typeof exemplar === "boolean") return value === true || value === "true";
  return String(value);
}

export function resolvePathValue(entity, update, path) {
  if (hasProperty(update, path)) return getProperty(update, path);
  return getProperty(entity, path);
}

export function resolveUpdatePath(update, path) {
  if (hasProperty(update, path)) return path;
  if (String(path).startsWith("system.")) {
    const systemRelativePath = String(path).slice("system.".length);
    if (hasProperty(update, systemRelativePath)) return systemRelativePath;
  }
  return undefined;
}

export function resolveTriggerRightValue(trigger, entity, leftValue, update = {}) {
  const rawValue = String(trigger.value ?? "").trim();
  if (rawValue.endsWith("%")) {
    const base = Number(resolvePathValue(entity, update, trigger.comparePath));
    return base * (Number(rawValue.slice(0, -1)) / 100);
  }
  if (rawValue && (hasProperty(update, rawValue) || hasProperty(entity, rawValue))) {
    return resolvePathValue(entity, update, rawValue);
  }
  if (!rawValue && trigger.comparePath) return resolvePathValue(entity, update, trigger.comparePath);
  return coerceValue(rawValue, leftValue);
}

export function buildTriggerLabel(trigger) {
  const operator = trigger.operator ?? OPERATORS.EQ;
  return `${trigger.path} ${operator} ${trigger.value}`;
}

export function normalizeTrigger(trigger) {
  if (!trigger?.id) throw makeError("Trigger requires an id.", { trigger });
  if (!trigger.path) throw makeError("Trigger requires a path.", { trigger });
  const operator = trigger.operator ?? OPERATORS.EQ;
  if (!COMPARATORS[operator]) throw makeError(`Unsupported trigger operator: ${operator}`, { trigger });
  return {
    ...trigger,
    operator,
    label: trigger.label ?? buildTriggerLabel({ ...trigger, operator }),
    actions: asArray(trigger.actions)
  };
}

export function linkedActionsForTrigger(trigger, conditions = []) {
  const actions = [];
  for (const condition of asArray(conditions)) {
    if (condition?.applyTriggerId === trigger.id) {
      actions.push({ type: ACTION_TYPES.APPLY_CONDITION, condition });
    }
    if (condition?.removeTriggerId === trigger.id) {
      actions.push({ type: ACTION_TYPES.REMOVE_CONDITION, condition });
    }
  }
  return actions;
}

export function evaluateTrigger(trigger, entity, update) {
  const prepared = normalizeTrigger(trigger);
  if (prepared.pcOnly && !entity?.hasPlayerOwner) return false;
  if (prepared.npcOnly && entity?.hasPlayerOwner) return false;
  const updatePath = resolveUpdatePath(update, prepared.path);
  if (!updatePath) return false;
  const leftValue = getProperty(update, updatePath);
  if (prepared.notZero && leftValue === 0) return false;
  const rightValue = resolveTriggerRightValue(prepared, entity, leftValue, update);
  return compareValues(prepared.operator, leftValue, rightValue);
}

export class TriggerEngine {
  constructor({ adapter, macroRunner = async () => undefined, conditionResolver = (condition) => condition } = {}) {
    this.adapter = adapter;
    this.macroRunner = macroRunner;
    this.conditionResolver = conditionResolver;
  }

  resolveAction(action) {
    if (!action.condition) return action;
    return {
      ...action,
      condition: this.conditionResolver(action.condition) ?? action.condition
    };
  }

  async processUpdate(entity, update, triggers = [], actionTarget = entity, conditions = []) {
    const matched = [];
    for (const trigger of triggers.map(normalizeTrigger)) {
      if (!evaluateTrigger(trigger, entity, update)) continue;
      matched.push(trigger);
      for (const action of [...trigger.actions, ...linkedActionsForTrigger(trigger, conditions)]) {
        await this.adapter.runAction(actionTarget, this.resolveAction(action), this.macroRunner);
      }
    }
    return matched;
  }
}

export function createDefaultTrigger(id, path, value, condition) {
  return normalizeTrigger({
    id,
    name: id,
    path,
    value,
    operator: OPERATORS.EQ,
    actions: [
      {
        type: ACTION_TYPES.APPLY_CONDITION,
        condition
      }
    ]
  });
}
