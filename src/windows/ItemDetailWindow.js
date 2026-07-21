import { ACTION_TYPES, OPERATORS, TEMPLATE_PATHS } from "../constants.js";
import { asArray, localize } from "../utils.js";
import {
  ACTION_OPTIONS,
  EFFECT_MODE_OPTIONS,
  OPERATOR_OPTIONS,
  PATH_OPTIONS,
  SCOPE_OPTIONS,
  buildConditionOptions,
  buildStatusOptions,
  buildTriggerOptions,
  summarizeTrigger
} from "./GMHubContext.js";
import { buildConditionPayload, buildTriggerPayload, readText, slugifyId } from "./GMHubActions.js";
import { bindItemDetailEvents } from "./ItemDetailEvents.js";

function localizeOptions(options, env) {
  return options.map((opt) => ({ value: opt.value, label: localize(opt.labelKey, opt.fallback, env) }));
}

function withSelected(options, currentValue) {
  return options.map((opt) => ({ ...opt, selected: opt.value === currentValue }));
}

function buildConditionContext(condition, dataManager, env) {
  const triggers = dataManager.getTriggers().map(summarizeTrigger);
  const triggerOptions = withSelected(buildTriggerOptions(triggers), condition.applyTriggerId ?? "");
  const removeTriggerOptions = withSelected(buildTriggerOptions(triggers), condition.removeTriggerId ?? "");
  const statusOptions = withSelected(buildStatusOptions(env), condition.id);
  const conditions = dataManager.getConditions();
  const effectModeOptions = localizeOptions(EFFECT_MODE_OPTIONS, env);
  const maxRows = 4;
  const changes = asArray(condition.changes).slice(0, maxRows);
  const changeRows = Array.from({ length: maxRows }, (_, i) => {
    const change = changes[i] ?? {};
    return {
      index: i + 1,
      key: change.key ?? "",
      value: change.value ?? "",
      priority: change.priority ?? 20,
      effectModeOptions: effectModeOptions.map((opt) => ({
        ...opt,
        selected: String(opt.value) === String(change.mode ?? 0)
      }))
    };
  });
  return {
    condition,
    statusOptions,
    triggerOptions,
    removeTriggerOptions,
    changeRows,
    effectModeOptions
  };
}

function buildTriggerContext(trigger, dataManager, env) {
  const knownPaths = PATH_OPTIONS.map((p) => p.value);
  const isKnownPath = knownPaths.includes(trigger.path);
  const pathOptions = withSelected(localizeOptions(PATH_OPTIONS, env), isKnownPath ? trigger.path : "");
  const operatorOptions = withSelected(localizeOptions(OPERATOR_OPTIONS, env), trigger.operator ?? OPERATORS.EQ);
  const action = asArray(trigger.actions)[0] ?? {};
  const actionOptions = withSelected(localizeOptions(ACTION_OPTIONS, env), action.type ?? ACTION_TYPES.NONE);
  const scope = trigger.pcOnly ? "pc" : trigger.npcOnly ? "npc" : "all";
  const scopeOptions = withSelected(localizeOptions(SCOPE_OPTIONS, env), scope);
  const conditions = dataManager.getConditions();
  const statusOptions = buildStatusOptions(env);
  const conditionOptions = withSelected(
    buildConditionOptions(conditions, statusOptions),
    action.condition ?? ""
  );
  return {
    trigger: {
      ...trigger,
      customPath: isKnownPath ? "" : trigger.path,
      macroId: action.type === ACTION_TYPES.RUN_MACRO ? (action.macroId ?? "") : "",
      comparePath: trigger.comparePath ?? ""
    },
    pathOptions,
    operatorOptions,
    actionOptions,
    scopeOptions,
    conditionOptions
  };
}

export function createItemDetailWindowClass(applicationApi) {
  const { ApplicationV2, HandlebarsApplicationMixin } = applicationApi;

  class ItemDetailBase extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      classes: ["ld-triggerz-gm-hub"],
      window: { resizable: true },
      position: { width: 520 }
    };

    constructor(options = {}) {
      super(options);
      this.itemType = options.itemType;
      this.item = options.item;
      this.dataManager = options.dataManager;
      this.conditionAdapter = options.conditionAdapter;
      this.uiManager = options.uiManager;
      this.env = options.env;
    }

    get title() {
      const label = this.item?.name ?? this.item?.id ?? "";
      return this.itemType === "condition"
        ? `${localize("LDTRIGGERZ.GMHub.ConditionBuilder", "Condition", this.env)}: ${label}`
        : `${localize("LDTRIGGERZ.GMHub.TriggerBuilder", "Trigger", this.env)}: ${label}`;
    }

    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      const specific = this.itemType === "condition"
        ? buildConditionContext(this.item, this.dataManager, this.env)
        : buildTriggerContext(this.item, this.dataManager, this.env);
      return { ...context, ...specific };
    }

    _onRender() {
      bindItemDetailEvents({
        element: this.element,
        itemType: this.itemType,
        item: this.item,
        dataManager: this.dataManager,
        conditionAdapter: this.conditionAdapter,
        uiManager: this.uiManager,
        window: this,
        env: this.env
      });
    }
  }

  class ConditionDetailWindow extends ItemDetailBase {
    static PARTS = {
      main: { template: TEMPLATE_PATHS.CONDITION_DETAIL, scrollY: [".ld-triggerz-hub"] }
    };
  }

  class TriggerDetailWindow extends ItemDetailBase {
    static PARTS = {
      main: { template: TEMPLATE_PATHS.TRIGGER_DETAIL, scrollY: [".ld-triggerz-hub"] }
    };
  }

  return { ConditionDetailWindow, TriggerDetailWindow };
}
