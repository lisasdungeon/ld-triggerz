import assert from "node:assert/strict";
import test from "node:test";
import { ConditionAdapter } from "../src/ConditionAdapter.js";
import { DataManager } from "../src/DataManager.js";
import {
  actorUpdateEntity,
  LDTriggerz,
  tokenActorEntity,
  tokenActorUpdateData
} from "../src/LDTriggerz.js";
import { createMacroRunner, resolveMacro } from "../src/MacroRunner.js";
import {
  buildTriggerLabel,
  compareValues,
  evaluateTrigger,
  isNumericValue,
  resolvePathValue,
  resolveTriggerRightValue,
  TriggerEngine
} from "../src/TriggerEngine.js";
import { asArray, cloneData, getProperty, hasProperty, localize, makeError } from "../src/utils.js";
import {
  actorAssignedConditionIds,
  assignedConditionLabels,
  buildGMHubContext,
  buildSelectedTokens,
  cleanStatusLabel,
  statusDisplayLabel,
  summarizeCondition,
  summarizeTrigger
} from "../src/windows/GMHubContext.js";
import {
  GMHubActions,
  buildConditionPayload,
  buildTriggerPayload,
  getNamedElement,
  readText,
  slugifyId
} from "../src/windows/GMHubActions.js";
import { bindGMHubEvents } from "../src/windows/GMHubEvents.js";
import { bindItemDetailEvents } from "../src/windows/ItemDetailEvents.js";
import { createItemDetailWindowClass } from "../src/windows/ItemDetailWindow.js";
import { ACTION_TYPES, OPERATORS } from "../src/constants.js";
import { createApplicationApi, makeDataManager, makeEnv } from "./helpers/mock-foundry.mjs";
import { installDom, resetDocumentBody } from "./helpers/dom-setup.mjs";
import {
  actorUpdateHook,
  getActiveInstance,
  initHook,
  registerHooks,
  resetHooksForTests,
  tokenUpdateHook
} from "../src/hooks.js";

installDom();

test("DataManager: default constructor args and get/set without clone env", async () => {
  const store = {};
  globalThis.game = {
    settings: {
      settings: { has: () => false },
      menus: { has: () => false },
      register: (m, k, d) => { store[`${m}.${k}`] = d.default; },
      registerMenu: () => {},
      get: (m, k) => store[`${m}.${k}`],
      set: (m, k, v) => { store[`${m}.${k}`] = v; return v; }
    }
  };
  try {
    const dm = new DataManager();
    dm.registerSettings();
    await dm.set("debug", true);
    assert.equal(dm.get("debug"), true);
  } finally {
    delete globalThis.game;
  }
});

test("ConditionAdapter branches: string condition names and transfer default", async () => {
  const adapter = new ConditionAdapter({ config: { statusEffects: [{ id: "stunned", name: "Stunned", label: "Stun" }] } });
  const actor = {
    effects: [],
    createEmbeddedDocuments: async (_t, data) => data,
    toggleStatusEffect: undefined
  };
  const created = await adapter.apply(actor, "stunned");
  // status exists so toggle would be used if present; without it falls through
  // status is found so toggleStatusEffect path preferred — recreate without status for string name path
  const adapter2 = new ConditionAdapter({ config: { statusEffects: [] } });
  const created2 = await adapter2.apply(actor, "homebrew");
  assert.equal(created2[0].name, "homebrew");
  assert.equal(created2[0].transfer, false);

  // condition object without name uses status name
  const adapter3 = new ConditionAdapter({ config: { statusEffects: [{ id: "x", name: "FromStatus" }] } });
  const actor3 = {
    effects: [],
    createEmbeddedDocuments: async (_t, data) => data
  };
  // has status so uses toggle
  actor3.toggleStatusEffect = async () => true;
  await adapter3.apply(actor3, { id: "x" });
});

test("ConditionAdapter constructor defaults config to global CONFIG", () => {
  globalThis.CONFIG = { statusEffects: [{ id: "z" }] };
  try {
    const adapter = new ConditionAdapter();
    assert.equal(adapter.getStatus("z").id, "z");
  } finally {
    delete globalThis.CONFIG;
  }
});

test("LDTriggerz internal merge branches: arrays, nested objects, multi-prefix paths", () => {
  assert.deepEqual(tokenActorUpdateData({ actorData: { delta: { "system.hp.value": 4 } } }), { "system.hp.value": 4 });
  // value that is array should replace not deep-merge
  const entity = actorUpdateEntity(
    { system: { tags: [1] }, toObject: () => ({ system: { tags: [1] } }) },
    { system: { tags: [2, 3] } }
  );
  assert.deepEqual(entity.system.tags, [2, 3]);

  // non-object source values
  const e2 = actorUpdateEntity({ toObject: () => ({}) }, { name: "A", count: 0, flag: false });
  assert.equal(e2.name, "A");
  assert.equal(e2.count, 0);

  // setPath creates intermediate objects when missing
  const e3 = actorUpdateEntity({ toObject: () => ({}) }, { "a.b.c": 9 });
  assert.equal(e3.a.b.c, 9);

  // token without hasPlayerOwner on actor
  const e4 = tokenActorEntity({ actor: { id: "a", toObject: () => ({ id: "a" }) } }, {});
  assert.equal(e4.id, "a");

  // documentData copies system/flags/id/name/type/img when present without toObject
  const e5 = actorUpdateEntity({ id: "1", name: "n", type: "t", img: "i", system: {}, flags: {} }, {});
  assert.equal(e5.type, "t");
});

test("LDTriggerz constructor defaults env; processTokenUpdate without actor", async () => {
  const settingsStore = {};
  globalThis.game = {
    settings: {
      settings: { has: (k) => Object.prototype.hasOwnProperty.call(settingsStore, k) },
      menus: { has: () => false },
      register: (m, k, d) => { settingsStore[`${m}.${k}`] = d.default; },
      registerMenu: () => {},
      get: (m, k) => settingsStore[`${m}.${k}`],
      set: (m, k, v) => { settingsStore[`${m}.${k}`] = v; }
    },
    socket: { on: () => {} },
    macros: { get: () => undefined },
    user: { isGM: true }
  };
  globalThis.CONFIG = { statusEffects: [] };
  globalThis.foundry = {
    applications: {
      api: {
        ApplicationV2: class { render() { return this; } },
        HandlebarsApplicationMixin: (B) => class extends B {}
      }
    }
  };
  globalThis.ui = { notifications: { error: () => {} } };
  try {
    const tz = new LDTriggerz().init();
    await tz.processTokenUpdate({ id: "t", system: { hp: 1 }, toObject: () => ({ id: "t" }) }, { name: "x" });
    assert.ok(tz.exportData());
  } finally {
    delete globalThis.game;
    delete globalThis.CONFIG;
    delete globalThis.foundry;
    delete globalThis.ui;
  }
});

test("MacroRunner: macro without id uses macroId in debug; execute with token target", async () => {
  const debugCalls = [];
  const macro = {
    name: "M",
    execute: async (scope) => scope
  };
  const env = {
    game: {
      macros: { get: (id) => (id === "mid" ? macro : undefined) },
      settings: { get: () => true }
    },
    console: { debug: (...a) => debugCalls.push(a), error: () => {} },
    ui: { notifications: { error: () => {} } }
  };
  const runner = createMacroRunner(env);
  const token = { actor: { id: "a1" } };
  const result = await runner("mid", token);
  assert.equal(result.token, token);
  assert.ok(debugCalls.length);
});

test("TriggerEngine remaining branches", () => {
  assert.equal(isNumericValue(0), true);
  assert.equal(compareValues(OPERATORS.NE, "a", "b"), true);
  assert.equal(buildTriggerLabel({ path: "p", value: 1 }), "p eq 1");
  assert.equal(resolvePathValue({ x: 1 }, {}, "x"), 1);
  // percent with comparePath from update
  assert.equal(
    resolveTriggerRightValue({ value: "25%", comparePath: "max" }, { max: 100 }, 0, { max: 40 }),
    10
  );
  // raw value path present only on entity
  assert.equal(resolveTriggerRightValue({ value: "cap" }, { cap: 9 }, 0, {}), 9);
  // evaluate notZero with non-zero
  assert.equal(
    evaluateTrigger({ id: "t", path: "v", operator: OPERATORS.EQ, value: 5, notZero: true }, {}, { v: 5 }),
    true
  );
  // conditionResolver default identity
  const engine = new TriggerEngine({ adapter: { runAction: async () => {} } });
  assert.equal(engine.conditionResolver("c"), "c");
});

test("utils remaining branches", () => {
  assert.equal(getProperty(null, "a.b"), undefined);
  assert.equal(getProperty({ a: null }, "a.b"), undefined);
  assert.equal(hasProperty({ a: 0 }, "a"), true);
  assert.deepEqual(asArray(0), [0]);
  assert.equal(localize("k"), "k");
  assert.deepEqual(makeError("m").details, {});
  // JSON fallback when no deepClone and structuredClone not a function on env
  const env = { structuredClone: "not-a-function" };
  assert.deepEqual(cloneData({ z: 1 }, env), { z: 1 });
});

test("GMHubContext remaining name/id fallbacks", () => {
  assert.equal(cleanStatusLabel("___"), "___");
  assert.equal(statusDisplayLabel({}), "");
  const tokens = buildSelectedTokens({
    canvas: {
      tokens: {
        controlled: [
          {},
          { document: {}, actor: { id: "act", name: "ActOnly", getFlag: () => null } }
        ]
      }
    }
  }, []);
  assert.equal(tokens[0].name, "Unknown token");
  assert.equal(tokens[1].name, "ActOnly");
  assert.equal(tokens[1].id, "act");
  assert.equal(summarizeCondition({ id: "c", changes: [{}, {}] }).changeSummary, "2 changes");
  assert.equal(summarizeTrigger({ path: "p", operator: "eq", value: 1, actions: [{ type: "x" }] }).actionSummary, "x");
  assert.deepEqual(actorAssignedConditionIds(null), []);
  assert.deepEqual(assignedConditionLabels([], []), []);

  const env = makeEnv();
  env.canvas = { tokens: { controlled: null } };
  const ctx = buildGMHubContext({ dataManager: makeDataManager(), env });
  assert.equal(ctx.selectedTokenCount, 0);
});

test("GMHubActions remaining form branches", () => {
  const form = {
    elements: {
      namedItem: undefined,
      only: { value: "v" }
    },
    only: { value: "v" }
  };
  // namedItem not a function falls through to elements[name]
  assert.equal(getNamedElement(form, "only").value, "v");
  assert.equal(readText({ elements: { namedItem: () => null } }, "x"), "");
  assert.equal(slugifyId("!!!"), "");

  const condition = buildConditionPayload({
    elements: {
      namedItem: (name) => {
        const map = {
          conditionId: { value: "" },
          statusId: { value: "" },
          conditionName: { value: "" },
          conditionImg: { value: "" },
          conditionDescription: { value: "" },
          applyTriggerId: { value: "" },
          removeTriggerId: { value: "" }
        };
        return map[name] ?? { value: "" };
      }
    }
  }, null);
  assert.equal(condition.id, "");
  assert.equal(condition.name, "");
  assert.equal(condition.img, "icons/svg/aura.svg");
});

test("GMHubEvents: missing dataManager and missing document short-circuit", () => {
  resetDocumentBody();
  const element = document.createElement("div");
  element.innerHTML = `<form data-ld-triggerz-condition-form><select name="applyTriggerId"></select></form>`;
  document.body.appendChild(element);
  bindGMHubEvents({
    element,
    actions: {},
    env: { document: null }
  });
  // with dataManager undefined
  bindGMHubEvents({
    element,
    actions: { dataManager: null },
    env: { document }
  });
  // preserve current value when repopulating
  const select = element.querySelector("select");
  const actions = {
    dataManager: {
      getTriggers: () => [{ id: "keep", name: "Keep", label: "L" }]
    }
  };
  select.innerHTML = `<option value="keep">Keep</option>`;
  select.value = "keep";
  bindGMHubEvents({ element, actions, env: { document } });
  assert.equal(select.value, "keep");
});

test("ItemDetailEvents: deleteCondition empty id; global FilePicker; notify without type", async () => {
  resetDocumentBody();
  const element = document.createElement("div");
  element.innerHTML = `
    <form data-ld-triggerz-condition-form>
      <input name="statusId" value="" />
      <input name="conditionId" value="c1" />
      <input name="conditionName" value="C" />
      <input name="conditionImg" value="icons/x.svg" />
      <input name="conditionDescription" value="" />
      <input name="applyTriggerId" value="" />
      <input name="removeTriggerId" value="" />
    </form>
    <button data-action="browse-icon" type="button"></button>
    <button data-action="delete-condition" data-id="" type="button"></button>
  `;
  document.body.appendChild(element);
  const calls = [];
  globalThis.FilePicker = class {
    constructor(o) { calls.push(o); }
    render() { return this; }
  };
  const env = makeEnv();
  env.foundry.applications.apps = {};
  const dataManager = makeDataManager({ conditions: [{ id: "c1" }] });
  bindItemDetailEvents({
    element,
    itemType: "condition",
    item: { id: "c1" },
    dataManager,
    uiManager: { renderOpenWindows: () => true },
    window: { close: () => {} },
    env
  });
  element.querySelector('[data-action="browse-icon"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  element.querySelector('[data-action="delete-condition"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(calls.length, 1);
  assert.equal(dataManager.getConditions().length, 1);
  delete globalThis.FilePicker;
});

test("ItemDetailWindow: empty item title; known path; all scope; apply condition action", async () => {
  const { ConditionDetailWindow, TriggerDetailWindow } = createItemDetailWindowClass(createApplicationApi());
  const env = makeEnv();
  const dataManager = makeDataManager({
    conditions: [{ id: "c1", name: "C1" }],
    triggers: []
  });
  const empty = new ConditionDetailWindow({
    itemType: "condition",
    item: null,
    dataManager,
    env
  });
  assert.match(empty.title, /Condition/);

  const win = new TriggerDetailWindow({
    itemType: "trigger",
    item: {
      id: "t",
      path: "system.hp.value",
      operator: OPERATORS.GT,
      value: "1",
      actions: [{ type: ACTION_TYPES.APPLY_CONDITION, condition: "c1" }]
    },
    dataManager,
    env
  });
  const ctx = await win._prepareContext({});
  assert.equal(ctx.trigger.customPath, "");
  assert.equal(ctx.trigger.macroId, "");
  assert.ok(ctx.scopeOptions.some((o) => o.value === "all" && o.selected));
  assert.ok(ctx.conditionOptions.some((o) => o.selected));
});

test("hooks: rejection catch arrows via registered callbacks; getActiveInstance", async () => {
  resetHooksForTests();
  const hooksOnce = [];
  const hooksOn = [];
  const errors = [];
  const settingsStore = {};
  const env = {
    game: {
      userId: "u",
      settings: {
        settings: { has: (k) => Object.prototype.hasOwnProperty.call(settingsStore, k) },
        menus: { has: () => false },
        register: (m, k, d) => { settingsStore[`${m}.${k}`] = d.default; },
        registerMenu: () => {},
        get: (m, k) => settingsStore[`${m}.${k}`],
        set: (m, k, v) => { settingsStore[`${m}.${k}`] = v; }
      },
      socket: { on: () => {} },
      macros: { get: () => undefined }
    },
    CONFIG: { statusEffects: [] },
    foundry: {
      applications: {
        api: {
          ApplicationV2: class {},
          HandlebarsApplicationMixin: (B) => class extends B {}
        }
      }
    },
    Hooks: {
      once: (n, f) => hooksOnce.push({ n, f }),
      on: (n, f) => hooksOn.push({ n, f })
    },
    console: { error: (...a) => errors.push(a), debug: () => {}, log: () => {} },
    ui: { notifications: { error: () => {} } }
  };
  registerHooks(env);
  hooksOnce.find((h) => h.n === "init").f();
  assert.ok(getActiveInstance());
  getActiveInstance().processActorUpdate = () => Promise.reject(new Error("actor-fail"));
  getActiveInstance().processTokenUpdate = () => Promise.reject(new Error("token-fail"));
  hooksOn.find((h) => h.n === "updateActor").f({ name: "A" }, {}, {}, "u");
  hooksOn.find((h) => h.n === "updateToken").f({ name: "T" }, {}, {}, "u");
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(errors.length >= 2);
  // mismatch userId via registered callback
  assert.equal(hooksOn.find((h) => h.n === "updateActor").f({}, {}, {}, "other"), false);
  assert.equal(hooksOn.find((h) => h.n === "updateToken").f({}, {}, {}, "other"), false);
});

test("GMHubActions selectedActors empty canvas", () => {
  const env = makeEnv();
  env.canvas = undefined;
  const actions = new GMHubActions({
    dataManager: makeDataManager(),
    uiManager: { renderOpenWindows: () => false },
    env
  });
  assert.deepEqual(actions.selectedActors(), []);
});

test("buildTriggerPayload defaults when actionType empty", () => {
  const form = {
    elements: {
      namedItem: (name) => {
        const values = {
          triggerPath: "hp",
          triggerPathCustom: "",
          triggerName: "N",
          operator: "",
          value: "1",
          actionType: "",
          actionCondition: "",
          macroId: "",
          comparePath: "",
          scope: "",
          triggerId: "tid",
          notZero: false
        };
        if (name === "notZero") return { checked: false };
        return { value: values[name] ?? "" };
      }
    }
  };
  const trigger = buildTriggerPayload(form);
  assert.equal(trigger.operator, OPERATORS.EQ);
  assert.deepEqual(trigger.actions, []);
});
