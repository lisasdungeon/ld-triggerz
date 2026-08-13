import assert from "node:assert/strict";
import test from "node:test";
import { DataManager } from "../src/DataManager.js";
import {
  actorUpdateHook,
  initHook,
  registerHooks,
  resetHooksForTests,
  tokenUpdateHook
} from "../src/hooks.js";
import { LDTriggerz } from "../src/LDTriggerz.js";
import {
  buildTriggerLabel,
  evaluateTrigger,
  isNumericValue,
  resolveTriggerRightValue,
  TriggerEngine
} from "../src/TriggerEngine.js";
import { ACTION_TYPES, OPERATORS } from "../src/constants.js";
import {
  actorAssignedConditionIds,
  buildSelectedTokens,
  summarizeCondition,
  summarizeTrigger
} from "../src/windows/GMHubContext.js";
import {
  buildConditionPayload,
  buildEffectChanges,
  buildTriggerPayload,
  getNamedElement,
  GMHubActions,
  slugifyId
} from "../src/windows/GMHubActions.js";
import { bindGMHubEvents } from "../src/windows/GMHubEvents.js";
import { bindItemDetailEvents } from "../src/windows/ItemDetailEvents.js";
import { createItemDetailWindowClass } from "../src/windows/ItemDetailWindow.js";
import { createApplicationApi, makeDataManager, makeEnv } from "./helpers/mock-foundry.mjs";
import { installDom, resetDocumentBody } from "./helpers/dom-setup.mjs";

installDom();

function makeGame() {
  const store = {};
  const menus = [];
  return {
    settings: {
      settings: { has: (k) => Object.prototype.hasOwnProperty.call(store, k) },
      menus: { has: (k) => menus.includes(k) },
      register: (m, k, d) => { store[`${m}.${k}`] = d.default; },
      registerMenu: (m, k) => menus.push(`${m}.${k}`),
      get: (m, k) => store[`${m}.${k}`],
      set: (m, k, v) => { store[`${m}.${k}`] = v; return v; }
    }
  };
}

test("DataManager filter callbacks run on non-empty collections", async () => {
  const dm = new DataManager({ game: makeGame() });
  dm.registerSettings();
  await dm.upsertTrigger({ id: "t1", path: "x" });
  await dm.upsertTrigger({ id: "t2", path: "y" });
  // replace existing id - filter callback must run over current items
  await dm.upsertTrigger({ id: "t1", path: "x2" });
  assert.equal(dm.getTriggers().length, 2);
  await dm.deleteTrigger("t2");
  assert.equal(dm.getTriggers().length, 1);

  await dm.upsertCondition({ id: "c1" });
  await dm.upsertCondition({ id: "c2" });
  await dm.upsertCondition({ id: "c1", name: "upd" });
  assert.equal(dm.getConditions().length, 2);
  await dm.deleteCondition("c2");
  assert.equal(dm.getConditions().length, 1);

  // throw branches (zero-count ranges when only happy path ran)
  await assert.rejects(() => dm.upsertTrigger({}), /requires an id/);
  await assert.rejects(() => dm.upsertCondition({}), /requires an id/);
});

test("hooks: scene-control getTriggerz arrow and nameless error fallbacks", async () => {
  resetHooksForTests();
  const hooksOnce = [];
  const hooksOn = [];
  const errors = [];
  const store = {};
  const env = {
    game: {
      userId: "u",
      settings: {
        settings: { has: (k) => Object.prototype.hasOwnProperty.call(store, k) },
        menus: { has: () => false },
        register: (m, k, d) => { store[`${m}.${k}`] = d.default; },
        registerMenu: () => {},
        get: (m, k) => store[`${m}.${k}`] ?? true,
        set: (m, k, v) => { store[`${m}.${k}`] = v; }
      },
      socket: { on: () => {} },
      macros: { get: () => undefined },
      i18n: { has: () => false, localize: (k) => k }
    },
    CONFIG: { statusEffects: [] },
    foundry: {
      applications: {
        api: {
          ApplicationV2: class { render() { return this; } },
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
  // Invoke getSceneControlButtons so () => activeInstance runs
  const scene = hooksOn.find((h) => h.n === "getSceneControlButtons");
  assert.ok(scene);
  const controls = [];
  scene.f(controls);
  assert.equal(controls.length, 1);

  // Rejection without name hits ?? id branch
  const instance = initHook(env);
  instance.processActorUpdate = () => Promise.reject(new Error(""));
  instance.processTokenUpdate = () => Promise.reject(new Error(""));
  actorUpdateHook({ id: "aid-only" }, {}, {}, "u", env);
  tokenUpdateHook({ id: "tid-only" }, {}, {}, "u", env);
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(errors.some((e) => String(e[0]).includes("aid-only")));
  assert.ok(errors.some((e) => String(e[0]).includes("tid-only")));
});

test("LDTriggerz conditionResolver arrow is invoked via processUpdate", async () => {
  const env = makeEnv();
  const tz = new LDTriggerz({ env }).init();
  env.game.settings.set("ld-triggerz", "triggers", [{
    id: "t1",
    path: "hp.value",
    operator: OPERATORS.EQ,
    value: 0,
    actions: [{ type: ACTION_TYPES.APPLY_CONDITION, condition: "bloodied" }]
  }]);
  env.game.settings.set("ld-triggerz", "conditions", [{ id: "bloodied", name: "Bloodied", changes: [] }]);
  const calls = [];
  tz.conditionAdapter.apply = async (target, condition) => {
    calls.push(condition);
    return true;
  };
  await tz.processActorUpdate(
    { id: "a1", hasPlayerOwner: true, system: { hp: { value: 5 } } },
    { "hp.value": 0 }
  );
  assert.ok(calls.length >= 1);
  assert.equal(calls[0].id, "bloodied");
});

test("TriggerEngine default macroRunner and remaining branches", async () => {
  const engine = new TriggerEngine({
    adapter: { runAction: async () => true }
  });
  assert.equal(await engine.macroRunner("x"), undefined);
  assert.equal(engine.conditionResolver("c"), "c");

  assert.equal(isNumericValue(null), false);
  assert.equal(buildTriggerLabel({ path: "p", value: 1 }), "p eq 1");
  // undefined value coerces against a numeric leftValue to Number("") === 0
  assert.equal(resolveTriggerRightValue({ value: undefined }, {}, 1, {}), 0);
  // blank value with comparePath reads that path
  assert.equal(resolveTriggerRightValue({ value: undefined, comparePath: "max" }, { max: 20 }, 1, {}), 20);
  // evaluate with operator default
  assert.equal(
    evaluateTrigger({ id: "t", path: "v", value: 1 }, {}, { v: 1 }),
    true
  );
});

test("GMHubContext map callbacks and optional chains", () => {
  // summarizeTrigger map over actions with type removeCondition and without condition/macroId
  const s = summarizeTrigger({
    path: "p",
    operator: "eq",
    value: 1,
    actions: [
      { type: "removeCondition" },
      { type: "applyCondition", condition: "c" }
    ]
  });
  assert.match(s.actionSummary, /!/);

  // changeCount === 1 branch already; ensure empty apply/remove ids
  const c = summarizeCondition({ id: "c", changes: [] });
  assert.equal(c.applyTriggerSummary, "");
  assert.equal(c.removeTriggerSummary, "");

  // actor flags nested optional when flags missing module
  assert.deepEqual(actorAssignedConditionIds({ flags: {} }), []);
  assert.deepEqual(actorAssignedConditionIds({ getFlag: () => undefined, flags: { "ld-triggerz": {} } }), []);

  // buildSelectedTokens with minimal token (all name fallbacks)
  const tokens = buildSelectedTokens({
    canvas: { tokens: { controlled: [{ document: { id: "d1" } }] } }
  }, []);
  assert.equal(tokens[0].id, "d1");
  assert.equal(tokens[0].name, "Unknown token");
});

test("GMHubActions form branches and map callbacks on controlled tokens", async () => {
  assert.equal(slugifyId(undefined), "");
  // getNamedElement when elements is nullish
  assert.equal(getNamedElement({}, "x"), undefined);

  const form = {
    elements: {
      namedItem: (name) => {
        const table = {
          changeKey1: { value: "k" },
          changeMode1: { value: "x" },
          changeValue1: { value: "1" },
          changePriority1: { value: "bad" },
          changeKey2: { value: "" },
          conditionId: { value: "id" },
          statusId: { value: "" },
          conditionName: { value: "N" },
          conditionImg: { value: "" },
          conditionDescription: { value: "" },
          applyTriggerId: { value: "" },
          removeTriggerId: { value: "" },
          triggerPathCustom: { value: "" },
          triggerPath: { value: "hp" },
          triggerName: { value: "T" },
          operator: { value: "eq" },
          value: { value: "1" },
          actionType: { value: ACTION_TYPES.RUN_MACRO },
          macroId: { value: "m" },
          comparePath: { value: "" },
          scope: { value: "pc" },
          triggerId: { value: "tid" },
          actionCondition: { value: "" },
          notZero: { checked: false }
        };
        return table[name] ?? { value: "" };
      }
    }
  };
  assert.equal(buildEffectChanges(form, 2).length, 1);
  assert.equal(buildConditionPayload(form, null).img, "icons/svg/aura.svg");
  assert.equal(buildTriggerPayload(form).pcOnly, true);

  const env = makeEnv();
  env.canvas = {
    tokens: {
      controlled: [
        { actor: null, document: { actor: { id: "via-doc" } } },
        { actor: { id: "direct" } },
        null
      ]
    }
  };
  const actions = new GMHubActions({
    dataManager: makeDataManager(),
    uiManager: { renderOpenWindows: () => false },
    env
  });
  const actors = actions.selectedActors();
  assert.ok(actors.some((a) => a.id === "via-doc"));
  assert.ok(actors.some((a) => a.id === "direct"));
});

test("GMHubEvents FilePicker callback and optional form short-circuits", async () => {
  resetDocumentBody();
  const element = document.createElement("div");
  element.innerHTML = `
    <textarea data-ld-triggerz-export></textarea>
    <form data-ld-triggerz-condition-form>
      <input name="conditionImg" value="icons/svg/aura.svg" />
      <select name="applyTriggerId"></select>
      <select name="removeTriggerId"></select>
    </form>
    <form data-ld-triggerz-trigger-form></form>
    <button data-action="browse-icon" type="button"></button>
    <button data-action="export" type="button"></button>
  `;
  document.body.appendChild(element);
  let callback;
  class FP {
    constructor(opts) { callback = opts.callback; }
    render() { return this; }
  }
  const actions = {
    dataManager: {
      getTriggers: () => [{ id: "t1", name: "Same", label: "Same" }]
    },
    exportToTextarea: () => {},
    saveConditionFromForm: async () => {},
    saveTriggerFromForm: async () => {}
  };
  bindGMHubEvents({
    element,
    actions,
    env: { document, foundry: { applications: { apps: { FilePicker: FP } } } }
  });
  element.querySelector('[data-action="browse-icon"]').click();
  assert.equal(typeof callback, "function");
  callback("icons/picked.svg");
  assert.equal(element.querySelector("[name='conditionImg']").value, "icons/picked.svg");

  // trigger name === id label branch
  const apply = element.querySelector("[name='applyTriggerId']");
  assert.ok([...apply.options].some((o) => o.textContent === "Same" || o.value === "t1"));
});

test("ItemDetailEvents FilePicker callback and deleteCondition path", async () => {
  resetDocumentBody();
  const element = document.createElement("div");
  element.innerHTML = `
    <form data-ld-triggerz-condition-form>
      <input name="statusId" value="" />
      <input name="conditionId" value="cx" />
      <input name="conditionName" value="CX" />
      <input name="conditionImg" value="icons/svg/aura.svg" />
      <input name="conditionDescription" value="" />
      <input name="applyTriggerId" value="" />
      <input name="removeTriggerId" value="" />
    </form>
    <button data-action="browse-icon" type="button"></button>
    <button data-action="delete-condition" data-id="cx" type="button"></button>
  `;
  document.body.appendChild(element);
  let callback;
  class FP {
    constructor(opts) { callback = opts.callback; }
    render() { return this; }
  }
  const dataManager = makeDataManager({ conditions: [{ id: "cx", name: "CX" }] });
  const env = makeEnv();
  env.foundry.applications.apps.FilePicker = FP;
  const closed = [];
  bindItemDetailEvents({
    element,
    itemType: "condition",
    item: { id: "cx" },
    dataManager,
    uiManager: { renderOpenWindows: () => true },
    window: { close: () => closed.push(1) },
    env
  });
  element.querySelector('[data-action="browse-icon"]').click();
  callback("icons/y.svg");
  assert.equal(element.querySelector("[name='conditionImg']").value, "icons/y.svg");
  element.querySelector('[data-action="delete-condition"]').click();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(dataManager.getConditions().length, 0);
  assert.equal(closed.length, 1);
});

test("ItemDetailWindow withSelected and localizeOptions via known/unknown paths", async () => {
  const { TriggerDetailWindow, ConditionDetailWindow } = createItemDetailWindowClass(createApplicationApi());
  const env = makeEnv();
  env.game.i18n = {
    has: (key) => key.startsWith("LDTRIGGERZ"),
    localize: (key) => `L:${key}`
  };
  const dataManager = makeDataManager({
    conditions: [{ id: "c1", name: "C1", changes: [] }],
    triggers: [{ id: "t1", name: "T1", path: "hp", operator: "eq", value: 0, actions: [], label: "hp eq 0" }]
  });

  const known = new TriggerDetailWindow({
    itemType: "trigger",
    item: {
      id: "t1",
      path: "system.attributes.hp.value",
      operator: OPERATORS.LTE,
      value: "0",
      actions: []
    },
    dataManager,
    env
  });
  const kctx = await known._prepareContext({});
  assert.ok(kctx.pathOptions.some((o) => o.selected));
  assert.ok(kctx.operatorOptions.some((o) => o.selected));

  // empty name/id title
  const bare = new ConditionDetailWindow({
    itemType: "condition",
    item: {},
    dataManager,
    env
  });
  assert.match(bare.title, /Condition/);
});
