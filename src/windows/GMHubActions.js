import { ConditionAdapter } from "../ConditionAdapter.js";
import { ACTION_TYPES, OPERATORS } from "../constants.js";
import { normalizeEffectChange } from "../EffectValues.js";
import { normalizeTrigger } from "../TriggerEngine.js";
import { asArray, localize } from "../utils.js";
import { statusDisplayLabel } from "./GMHubContext.js";

export function slugifyId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getNamedElement(form, name) {
  const elements = form?.elements;
  if (typeof elements?.namedItem === "function") return elements.namedItem(name);
  return elements?.[name] ?? form?.[name];
}

export function readText(form, name) {
  return String(getNamedElement(form, name)?.value ?? "").trim();
}

export function readBoolean(form, name) {
  return Boolean(getNamedElement(form, name)?.checked);
}

export function readNumber(form, name, fallback) {
  const value = Number(readText(form, name));
  return Number.isFinite(value) ? value : fallback;
}

export function buildEffectChanges(form, maxRows = 4) {
  const changes = [];
  for (let index = 1; index <= maxRows; index += 1) {
    const key = readText(form, `changeKey${index}`);
    if (!key) continue;
    changes.push(normalizeEffectChange({
      key,
      mode: readNumber(form, `changeMode${index}`, 0),
      value: readText(form, `changeValue${index}`),
      priority: readNumber(form, `changePriority${index}`, 20)
    }));
  }
  return changes;
}

export function buildConditionPayload(form, status) {
  const customId = readText(form, "conditionId");
  const statusId = readText(form, "statusId");
  const id = customId || statusId;
  const changes = buildEffectChanges(form);
  const condition = {
    id,
    name: readText(form, "conditionName") || statusDisplayLabel(status) || id,
    img: readText(form, "conditionImg") || status?.img || "icons/svg/aura.svg",
    description: readText(form, "conditionDescription"),
    changes,
    homebrew: Boolean(customId || changes.length)
  };
  const applyTriggerId = readText(form, "applyTriggerId");
  const removeTriggerId = readText(form, "removeTriggerId");
  if (applyTriggerId) condition.applyTriggerId = applyTriggerId;
  if (removeTriggerId) condition.removeTriggerId = removeTriggerId;
  return condition;
}

export function buildTriggerPayload(form) {
  const path = readText(form, "triggerPathCustom") || readText(form, "triggerPath");
  const name = readText(form, "triggerName");
  const operator = readText(form, "operator") || OPERATORS.EQ;
  const value = readText(form, "value");
  const actionType = readText(form, "actionType") || ACTION_TYPES.NONE;
  const comparePath = readText(form, "comparePath");
  const scope = readText(form, "scope");
  const actions = [];
  if (actionType === ACTION_TYPES.RUN_MACRO) {
    actions.push({ type: actionType, macroId: readText(form, "macroId") });
  } else if (actionType !== ACTION_TYPES.NONE) {
    actions.push({ type: actionType, condition: readText(form, "actionCondition") });
  }
  const trigger = {
    id: readText(form, "triggerId") || slugifyId(`${name || path}-${operator}-${value}-${actionType}`),
    name: name || slugifyId(path),
    path,
    operator,
    value,
    actions
  };
  if (comparePath) trigger.comparePath = comparePath;
  if (scope === "pc") trigger.pcOnly = true;
  if (scope === "npc") trigger.npcOnly = true;
  if (readBoolean(form, "notZero")) trigger.notZero = true;
  return trigger;
}

export class GMHubActions {
  constructor({ dataManager, conditionAdapter, uiManager, env = globalThis } = {}) {
    this.dataManager = dataManager;
    this.conditionAdapter = conditionAdapter ?? new ConditionAdapter({ config: env.CONFIG });
    this.uiManager = uiManager;
    this.env = env;
  }

  notify(type, key, fallback) {
    const message = localize(key, fallback, this.env);
    const notifications = this.env.ui?.notifications;
    const notifier = notifications?.[type];
    if (typeof notifier === "function") notifier.call(notifications, message);
    return message;
  }

  render() {
    return this.uiManager.renderOpenWindows();
  }

  getStatus(id) {
    return asArray(this.env.CONFIG?.statusEffects).find((status) => status.id === id);
  }

  resolveCondition(id) {
    const conditionId = String(id ?? "").trim();
    if (!conditionId) return null;
    const saved = this.dataManager.getConditions().find((condition) => condition.id === conditionId);
    if (saved) return saved;
    const status = this.getStatus(conditionId);
    return {
      id: conditionId,
      name: statusDisplayLabel(status, this.env) || conditionId,
      img: status?.img ?? "icons/svg/aura.svg",
      changes: []
    };
  }

  exportToTextarea(textarea) {
    const payload = JSON.stringify(this.dataManager.exportData(), null, 2);
    textarea.value = payload;
    return payload;
  }

  async importFromTextarea(textarea) {
    try {
      const parsed = JSON.parse(textarea.value);
      await this.dataManager.importData(parsed);
      this.notify("info", "LDTRIGGERZ.Notifications.Imported", "LD Triggerz data imported.");
      this.render();
      return parsed;
    } catch (error) {
      this.notify("error", "LDTRIGGERZ.Notifications.ImportFailed", error.message);
      return null;
    }
  }

  refresh() {
    return this.render();
  }

  async saveConditionFromForm(form) {
    const statusId = readText(form, "statusId");
    const condition = buildConditionPayload(form, this.getStatus(statusId));
    if (!condition.id) {
      this.notify("error", "LDTRIGGERZ.Notifications.ConditionRequired", "Condition ID is required.");
      return null;
    }
    const saved = await this.dataManager.upsertCondition(condition);
    this.notify("info", "LDTRIGGERZ.Notifications.ConditionSaved", "Condition saved.");
    this.render();
    return saved;
  }

  async deleteCondition(id) {
    if (!id) return null;
    const remaining = await this.dataManager.deleteCondition(id);
    this.notify("info", "LDTRIGGERZ.Notifications.ConditionDeleted", "Condition deleted.");
    this.render();
    return remaining;
  }

  async saveTriggerFromForm(form) {
    const trigger = buildTriggerPayload(form);
    const action = trigger.actions[0];
    if (!trigger.path) {
      this.notify("error", "LDTRIGGERZ.Notifications.TriggerPathRequired", "Trigger path is required.");
      return null;
    }
    if (!action) {
      const saved = await this.dataManager.upsertTrigger(normalizeTrigger(trigger));
      this.notify("info", "LDTRIGGERZ.Notifications.TriggerSaved", "Trigger saved.");
      this.render();
      return saved;
    }
    if (action.type === ACTION_TYPES.RUN_MACRO && !action.macroId) {
      this.notify("error", "LDTRIGGERZ.Notifications.MacroRequired", "Macro ID is required.");
      return null;
    }
    if (action.type !== ACTION_TYPES.RUN_MACRO && !action.condition) {
      this.notify("error", "LDTRIGGERZ.Notifications.TriggerConditionRequired", "Trigger condition is required.");
      return null;
    }
    const saved = await this.dataManager.upsertTrigger(normalizeTrigger(trigger));
    this.notify("info", "LDTRIGGERZ.Notifications.TriggerSaved", "Trigger saved.");
    this.render();
    return saved;
  }

  async deleteTrigger(id) {
    if (!id) return null;
    const remaining = await this.dataManager.deleteTrigger(id);
    this.notify("info", "LDTRIGGERZ.Notifications.TriggerDeleted", "Trigger deleted.");
    this.render();
    return remaining;
  }

  editCondition(id) {
    if (!id) return null;
    const condition = this.dataManager.getConditions().find((c) => c.id === id);
    if (!condition) return null;
    return this.uiManager.openDetail({ itemType: "condition", item: condition });
  }

  editTrigger(id) {
    if (!id) return null;
    const trigger = this.dataManager.getTriggers().find((t) => t.id === id);
    if (!trigger) return null;
    return this.uiManager.openDetail({ itemType: "trigger", item: trigger });
  }

  selectedActors() {
    return asArray(this.env.canvas?.tokens?.controlled)
      .map((token) => token?.actor ?? token?.document?.actor ?? token)
      .filter(Boolean);
  }

  async applyToSelected(method, conditionId) {
    const condition = this.resolveCondition(conditionId);
    if (!condition) {
      this.notify("error", "LDTRIGGERZ.Notifications.ConditionRequired", "Condition ID is required.");
      return [];
    }
    const actors = this.selectedActors();
    if (!actors.length) {
      this.notify("warn", "LDTRIGGERZ.Notifications.NoSelectedTokens", "No tokens selected.");
      return [];
    }
    const results = [];
    for (const actor of actors) {
      results.push(await this.conditionAdapter[method](actor, condition));
    }
    this.notify("info", "LDTRIGGERZ.Notifications.SelectedApplied", "Selected tokens updated.");
    this.render();
    return results;
  }

  async assignToSelected(conditionId) {
    const condition = this.resolveCondition(conditionId);
    if (!condition) {
      this.notify("error", "LDTRIGGERZ.Notifications.ConditionRequired", "Condition ID is required.");
      return [];
    }
    const actors = this.selectedActors();
    if (!actors.length) {
      this.notify("warn", "LDTRIGGERZ.Notifications.NoSelectedTokens", "No tokens selected.");
      return [];
    }
    const results = [];
    for (const actor of actors) {
      results.push(await this.conditionAdapter.assign(actor, condition));
    }
    this.notify("info", "LDTRIGGERZ.Notifications.ActorAssignmentsUpdated", "Actor condition assignments updated.");
    this.render();
    return results;
  }

  async unassignFromSelected(conditionId) {
    const condition = this.resolveCondition(conditionId);
    if (!condition) {
      this.notify("error", "LDTRIGGERZ.Notifications.ConditionRequired", "Condition ID is required.");
      return [];
    }
    const actors = this.selectedActors();
    if (!actors.length) {
      this.notify("warn", "LDTRIGGERZ.Notifications.NoSelectedTokens", "No tokens selected.");
      return [];
    }
    const results = [];
    for (const actor of actors) {
      results.push(await this.conditionAdapter.unassign(actor, condition));
    }
    this.notify("info", "LDTRIGGERZ.Notifications.ActorAssignmentsUpdated", "Actor condition assignments updated.");
    this.render();
    return results;
  }
}
