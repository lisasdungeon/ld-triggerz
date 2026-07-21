import { ACTION_TYPES } from "../constants.js";
import { normalizeTrigger } from "../TriggerEngine.js";
import { localize } from "../utils.js";
import { buildConditionPayload, buildTriggerPayload } from "./GMHubActions.js";

function prevent(event) {
  event.preventDefault();
  return event.currentTarget;
}

function browseIcon(element, env) {
  const input = element?.querySelector("[name='conditionImg']");
  if (!input) return;
  const FP = env?.foundry?.applications?.apps?.FilePicker?.implementation
    ?? env?.foundry?.applications?.apps?.FilePicker
    ?? globalThis.FilePicker;
  if (typeof FP !== "function") return;
  new FP({ type: "image", current: input.value || "icons/svg/", field: input, callback: (path) => { input.value = path; } }).render();
}

function notify(type, key, fallback, env) {
  const message = localize(key, fallback, env);
  const notifier = env?.ui?.notifications?.[type];
  if (typeof notifier === "function") notifier.call(env.ui.notifications, message);
  return message;
}

async function saveCondition(form, dataManager, conditionAdapter, uiManager, win, env) {
  const statusId = form?.elements?.statusId?.value ?? "";
  const status = env?.CONFIG?.statusEffects?.find?.((s) => s.id === statusId);
  const condition = buildConditionPayload(form, status);
  if (!condition.id) {
    notify("error", "LDTRIGGERZ.Notifications.ConditionRequired", "Condition ID is required.", env);
    return null;
  }
  await dataManager.upsertCondition(condition);
  notify("info", "LDTRIGGERZ.Notifications.ConditionSaved", "Condition saved.", env);
  uiManager.renderOpenWindows();
  win.close();
  return condition;
}

async function saveTrigger(form, dataManager, uiManager, win, env) {
  const trigger = buildTriggerPayload(form);
  const action = trigger.actions[0];
  if (!trigger.path) {
    notify("error", "LDTRIGGERZ.Notifications.TriggerPathRequired", "Trigger path is required.", env);
    return null;
  }
  if (action?.type === ACTION_TYPES.RUN_MACRO && !action.macroId) {
    notify("error", "LDTRIGGERZ.Notifications.MacroRequired", "Macro ID is required.", env);
    return null;
  }
  if (action && action.type !== ACTION_TYPES.RUN_MACRO && action.type !== ACTION_TYPES.NONE && !action.condition) {
    notify("error", "LDTRIGGERZ.Notifications.TriggerConditionRequired", "Trigger condition is required.", env);
    return null;
  }
  await dataManager.upsertTrigger(normalizeTrigger(trigger));
  notify("info", "LDTRIGGERZ.Notifications.TriggerSaved", "Trigger saved.", env);
  uiManager.renderOpenWindows();
  win.close();
  return trigger;
}

async function deleteCondition(id, dataManager, uiManager, win, env) {
  if (!id) return null;
  await dataManager.deleteCondition(id);
  notify("info", "LDTRIGGERZ.Notifications.ConditionDeleted", "Condition deleted.", env);
  uiManager.renderOpenWindows();
  win.close();
}

async function deleteTrigger(id, dataManager, uiManager, win, env) {
  if (!id) return null;
  await dataManager.deleteTrigger(id);
  notify("info", "LDTRIGGERZ.Notifications.TriggerDeleted", "Trigger deleted.", env);
  uiManager.renderOpenWindows();
  win.close();
}

export function bindItemDetailEvents({ element, itemType, item, dataManager, conditionAdapter, uiManager, window: win, env = globalThis } = {}) {
  const isCondition = itemType === "condition";
  const form = element?.querySelector(isCondition ? "[data-ld-triggerz-condition-form]" : "[data-ld-triggerz-trigger-form]");
  const buttons = [...(element?.querySelectorAll("[data-action]") ?? [])];

  form?.addEventListener("submit", async (event) => {
    const f = prevent(event);
    if (isCondition) await saveCondition(f, dataManager, conditionAdapter, uiManager, win, env);
    else await saveTrigger(f, dataManager, uiManager, win, env);
  });

  for (const button of buttons) {
    button.addEventListener("click", async (event) => {
      const action = event.currentTarget.dataset.action;
      const id = event.currentTarget.dataset.id;
      if (action === "browse-icon") { browseIcon(form, env); return; }
      if (action === "delete-condition") await deleteCondition(id, dataManager, uiManager, win, env);
      if (action === "delete-trigger") await deleteTrigger(id, dataManager, uiManager, win, env);
    });
  }

  return buttons.length + Number(Boolean(form));
}
