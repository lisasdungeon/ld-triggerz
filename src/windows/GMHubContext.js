import { ACTION_TYPES, ACTOR_FLAG_KEYS, MODULE_ID, MODULE_VERSION, OPERATORS } from "../constants.js";
import { asArray, localize } from "../utils.js";

export const PATH_OPTIONS = Object.freeze([
  { value: "system.attributes.hp.value", labelKey: "LDTRIGGERZ.Paths.AttributeHP", fallback: "Attribute HP Current" },
  { value: "system.attributes.hp.max", labelKey: "LDTRIGGERZ.Paths.AttributeHPMax", fallback: "Attribute HP Max" },
  { value: "system.hp.value", labelKey: "LDTRIGGERZ.Paths.HP", fallback: "HP Current" },
  { value: "system.hp.max", labelKey: "LDTRIGGERZ.Paths.HPMax", fallback: "HP Max" },
  { value: "system.health.value", labelKey: "LDTRIGGERZ.Paths.Health", fallback: "Health Current" },
  { value: "system.health.max", labelKey: "LDTRIGGERZ.Paths.HealthMax", fallback: "Health Max" }
]);

export const OPERATOR_OPTIONS = Object.freeze([
  { value: OPERATORS.EQ, labelKey: "LDTRIGGERZ.Operators.EQ", fallback: "Equals" },
  { value: OPERATORS.NE, labelKey: "LDTRIGGERZ.Operators.NE", fallback: "Does not equal" },
  { value: OPERATORS.LT, labelKey: "LDTRIGGERZ.Operators.LT", fallback: "Less than" },
  { value: OPERATORS.LTE, labelKey: "LDTRIGGERZ.Operators.LTE", fallback: "Less than or equal" },
  { value: OPERATORS.GT, labelKey: "LDTRIGGERZ.Operators.GT", fallback: "Greater than" },
  { value: OPERATORS.GTE, labelKey: "LDTRIGGERZ.Operators.GTE", fallback: "Greater than or equal" }
]);

export const ACTION_OPTIONS = Object.freeze([
  { value: ACTION_TYPES.NONE, labelKey: "LDTRIGGERZ.Actions.None", fallback: "None" },
  { value: ACTION_TYPES.APPLY_CONDITION, labelKey: "LDTRIGGERZ.Actions.ApplyCondition", fallback: "Apply condition" },
  { value: ACTION_TYPES.REMOVE_CONDITION, labelKey: "LDTRIGGERZ.Actions.RemoveCondition", fallback: "Remove condition" },
  { value: ACTION_TYPES.TOGGLE_CONDITION, labelKey: "LDTRIGGERZ.Actions.ToggleCondition", fallback: "Toggle condition" },
  { value: ACTION_TYPES.RUN_MACRO, labelKey: "LDTRIGGERZ.Actions.RunMacro", fallback: "Run macro" }
]);

export const SCOPE_OPTIONS = Object.freeze([
  { value: "all", labelKey: "LDTRIGGERZ.Scopes.All", fallback: "All actors" },
  { value: "pc", labelKey: "LDTRIGGERZ.Scopes.PC", fallback: "PC actors only" },
  { value: "npc", labelKey: "LDTRIGGERZ.Scopes.NPC", fallback: "NPC actors only" }
]);

export const EFFECT_MODE_OPTIONS = Object.freeze([
  { value: "0", labelKey: "LDTRIGGERZ.EffectModes.Custom", fallback: "Custom" },
  { value: "1", labelKey: "LDTRIGGERZ.EffectModes.Multiply", fallback: "Multiply" },
  { value: "2", labelKey: "LDTRIGGERZ.EffectModes.Add", fallback: "Add" },
  { value: "3", labelKey: "LDTRIGGERZ.EffectModes.Downgrade", fallback: "Downgrade" },
  { value: "4", labelKey: "LDTRIGGERZ.EffectModes.Upgrade", fallback: "Upgrade" },
  { value: "5", labelKey: "LDTRIGGERZ.EffectModes.Override", fallback: "Override" }
]);

function localizeOptions(options, env) {
  return options.map((option) => ({
    value: option.value,
    label: localize(option.labelKey, option.fallback, env)
  }));
}

export function cleanStatusLabel(label) {
  const raw = String(label ?? "").trim();
  if (!raw) return "";
  const finalSegment = raw.includes(".") ? raw.split(".").pop() : raw;
  const withoutStatusPrefix = finalSegment.replace(/^Status/, "");
  return withoutStatusPrefix
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim() || raw;
}

export function statusDisplayLabel(status, env = globalThis) {
  const raw = status?.name ?? status?.label ?? status?.id ?? "";
  const fallback = cleanStatusLabel(raw);
  const shouldLocalize = /\./.test(String(raw)) && !/\s/.test(String(raw));
  const translated = shouldLocalize ? localize(raw, fallback, env) : fallback;
  return translated === raw ? fallback : translated;
}

export function buildStatusOptions(env = globalThis) {
  return asArray(env.CONFIG?.statusEffects)
    .map((status) => ({
      value: status.id,
      label: statusDisplayLabel(status, env),
      img: status.img
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function buildConditionOptions(conditions, statusOptions) {
  const saved = conditions.map((condition) => ({
    value: condition.id,
    label: condition.name ?? condition.id,
    source: "saved"
  }));
  const savedIds = new Set(saved.map((condition) => condition.value));
  const statuses = statusOptions
    .filter((status) => !savedIds.has(status.value))
    .map((status) => ({
      value: status.value,
      label: status.label,
      source: "status"
    }));
  return [...saved, ...statuses];
}

export function summarizeTrigger(trigger) {
  const actions = asArray(trigger.actions);
  return {
    ...trigger,
    label: trigger.label ?? `${trigger.path} ${trigger.operator} ${trigger.value}`,
    actionSummary: actions.map((action) => {
      const label = action.condition ?? action.macroId ?? action.type;
      return action.type === "removeCondition" ? `!${label}` : label;
    }).join(", ") || "No actions"
  };
}

export function buildTriggerOptions(triggers) {
  return triggers.map((trigger) => ({
    value: trigger.id,
    label: trigger.name && trigger.name !== trigger.id ? `${trigger.name} - ${trigger.label}` : trigger.label
  }));
}

export function summarizeCondition(condition, triggerLabels = new Map()) {
  const changeCount = asArray(condition.changes).length;
  const applyTriggerId = condition.applyTriggerId ?? "";
  const removeTriggerId = condition.removeTriggerId ?? "";
  return {
    ...condition,
    label: condition.name ?? condition.id,
    img: condition.img ?? "icons/svg/aura.svg",
    description: condition.description ?? "",
    changeSummary: changeCount ? `${changeCount} change${changeCount === 1 ? "" : "s"}` : "No changes",
    applyTriggerId,
    removeTriggerId,
    applyTriggerSummary: applyTriggerId ? triggerLabels.get(applyTriggerId) ?? applyTriggerId : "",
    removeTriggerSummary: removeTriggerId ? triggerLabels.get(removeTriggerId) ?? removeTriggerId : ""
  };
}

export function actorAssignedConditionIds(actor) {
  const fromGetter = actor?.getFlag?.(MODULE_ID, ACTOR_FLAG_KEYS.ASSIGNED_CONDITIONS);
  const fromData = actor?.flags?.[MODULE_ID]?.[ACTOR_FLAG_KEYS.ASSIGNED_CONDITIONS];
  return asArray(fromGetter ?? fromData).filter(Boolean);
}

export function assignedConditionLabels(ids, conditionOptions) {
  const labels = new Map(conditionOptions.map((condition) => [condition.value, condition.label]));
  return ids.map((id) => labels.get(id) ?? id);
}

export function buildSelectedTokens(env = globalThis, conditionOptions = []) {
  return asArray(env.canvas?.tokens?.controlled).map((token) => ({
    id: token.id ?? token.document?.id ?? token.actor?.id,
    name: token.name ?? token.document?.name ?? token.actor?.name ?? "Unknown token",
    assignedConditionIds: actorAssignedConditionIds(token.actor ?? token.document?.actor ?? token)
  })).map((token) => ({
    ...token,
    assignedConditions: assignedConditionLabels(token.assignedConditionIds, conditionOptions),
    assignmentSummary: token.assignedConditionIds.length
      ? assignedConditionLabels(token.assignedConditionIds, conditionOptions).join(", ")
      : "No assigned conditions"
  }));
}

export function buildGMHubContext({ dataManager, env = globalThis } = {}) {
  const data = dataManager.exportData();
  const triggers = data.triggers.map(summarizeTrigger);
  const triggerOptions = buildTriggerOptions(triggers);
  const triggerLabels = new Map(triggerOptions.map((trigger) => [trigger.value, trigger.label]));
  const conditions = data.conditions.map((condition) => summarizeCondition(condition, triggerLabels));
  const statusOptions = buildStatusOptions(env);
  const conditionOptions = buildConditionOptions(conditions, statusOptions);
  const selectedTokens = buildSelectedTokens(env, conditionOptions);
  return {
    version: MODULE_VERSION,
    moduleMode: localize("LDTRIGGERZ.GMHub.SystemAgnostic", "System Agnostic", env),
    mode: env.game.user.isGM ? "GM" : "Player",
    triggerCount: data.triggers.length,
    conditionCount: data.conditions.length,
    selectedTokenCount: selectedTokens.length,
    triggers,
    conditions,
    triggerOptions,
    conditionOptions,
    statusOptions,
    selectedTokens,
    pathOptions: localizeOptions(PATH_OPTIONS, env),
    operatorOptions: localizeOptions(OPERATOR_OPTIONS, env),
    actionOptions: localizeOptions(ACTION_OPTIONS, env),
    scopeOptions: localizeOptions(SCOPE_OPTIONS, env),
    effectModeOptions: localizeOptions(EFFECT_MODE_OPTIONS, env),
    exportJson: JSON.stringify(data, null, 2)
  };
}
