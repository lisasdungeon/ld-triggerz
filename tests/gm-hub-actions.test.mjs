import assert from "node:assert/strict";
import test from "node:test";
import {
  GMHubActions,
  buildConditionPayload,
  buildEffectChanges,
  buildTriggerPayload,
  getNamedElement,
  readBoolean,
  readNumber,
  readText,
  slugifyId
} from "../src/windows/GMHubActions.js";
import { ACTION_TYPES } from "../src/constants.js";
import { makeDataManager, makeEnv } from "./helpers/mock-foundry.mjs";

function makeForm(fields) {
  const store = { ...fields };
  const elements = {
    namedItem: (name) => store[name] ?? null
  };
  return { elements, ...Object.fromEntries(Object.entries(store).map(([k, v]) => [k, v])) };
}

test("slugifyId: normalizes free text to ids", () => {
  assert.equal(slugifyId(" Hello World! "), "hello-world");
  assert.equal(slugifyId(null), "");
});

test("getNamedElement / read helpers", () => {
  const form = makeForm({
    name: { value: "  Hi  " },
    flag: { checked: true },
    num: { value: "12" },
    bad: { value: "nope" }
  });
  assert.equal(readText(form, "name"), "Hi");
  assert.equal(readBoolean(form, "flag"), true);
  assert.equal(readNumber(form, "num", 0), 12);
  assert.equal(readNumber(form, "bad", 7), 7);
  assert.equal(getNamedElement(null, "x"), undefined);
  assert.equal(getNamedElement({ name: { value: "a" } }, "name").value, "a");
  assert.equal(getNamedElement({ elements: { foo: { value: "z" } } }, "foo").value, "z");
});

test("buildEffectChanges: skips empty keys and normalizes rows", () => {
  const form = makeForm({
    changeKey1: { value: "system.props.hp" },
    changeMode1: { value: "2" },
    changeValue1: { value: "1" },
    changePriority1: { value: "10" },
    changeKey2: { value: "" }
  });
  const changes = buildEffectChanges(form, 2);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].key, "system.props.hp");
});

test("buildConditionPayload: builds homebrew condition with optional triggers", () => {
  const form = makeForm({
    conditionId: { value: "custom" },
    statusId: { value: "bloodied" },
    conditionName: { value: "Custom" },
    conditionImg: { value: "icons/x.svg" },
    conditionDescription: { value: "desc" },
    applyTriggerId: { value: "t1" },
    removeTriggerId: { value: "t2" },
    changeKey1: { value: "" }
  });
  const condition = buildConditionPayload(form, { img: "icons/status.svg", name: "Bloodied" });
  assert.equal(condition.id, "custom");
  assert.equal(condition.homebrew, true);
  assert.equal(condition.applyTriggerId, "t1");
  assert.equal(condition.removeTriggerId, "t2");
});

test("buildConditionPayload: falls back to status id and label", () => {
  const form = makeForm({
    conditionId: { value: "" },
    statusId: { value: "bloodied" },
    conditionName: { value: "" },
    conditionImg: { value: "" },
    conditionDescription: { value: "" },
    applyTriggerId: { value: "" },
    removeTriggerId: { value: "" }
  });
  const condition = buildConditionPayload(form, { id: "bloodied", name: "Bloodied", img: "icons/b.svg" });
  assert.equal(condition.id, "bloodied");
  assert.equal(condition.name, "Bloodied");
  assert.equal(condition.img, "icons/b.svg");
  assert.equal(condition.homebrew, false);
});

test("buildTriggerPayload: macro, condition, scope, comparePath, notZero", () => {
  const macroForm = makeForm({
    triggerPathCustom: { value: "" },
    triggerPath: { value: "system.hp.value" },
    triggerName: { value: "Low HP" },
    operator: { value: "lte" },
    value: { value: "0" },
    actionType: { value: ACTION_TYPES.RUN_MACRO },
    macroId: { value: "m1" },
    comparePath: { value: "system.hp.max" },
    scope: { value: "pc" },
    triggerId: { value: "t1" },
    notZero: { checked: true },
    actionCondition: { value: "" }
  });
  const macroTrigger = buildTriggerPayload(macroForm);
  assert.equal(macroTrigger.actions[0].macroId, "m1");
  assert.equal(macroTrigger.pcOnly, true);
  assert.equal(macroTrigger.notZero, true);
  assert.equal(macroTrigger.comparePath, "system.hp.max");

  const npcForm = makeForm({
    triggerPathCustom: { value: "custom.path" },
    triggerPath: { value: "" },
    triggerName: { value: "" },
    operator: { value: "" },
    value: { value: "1" },
    actionType: { value: ACTION_TYPES.APPLY_CONDITION },
    actionCondition: { value: "bloodied" },
    comparePath: { value: "" },
    scope: { value: "npc" },
    triggerId: { value: "" },
    notZero: { checked: false },
    macroId: { value: "" }
  });
  const npcTrigger = buildTriggerPayload(npcForm);
  assert.equal(npcTrigger.path, "custom.path");
  assert.equal(npcTrigger.npcOnly, true);
  assert.equal(npcTrigger.actions[0].condition, "bloodied");
  assert.ok(npcTrigger.id);

  const noneForm = makeForm({
    triggerPathCustom: { value: "" },
    triggerPath: { value: "hp" },
    triggerName: { value: "N" },
    operator: { value: "eq" },
    value: { value: "1" },
    actionType: { value: ACTION_TYPES.NONE },
    actionCondition: { value: "" },
    comparePath: { value: "" },
    scope: { value: "all" },
    triggerId: { value: "t-none" },
    notZero: { checked: false },
    macroId: { value: "" }
  });
  assert.deepEqual(buildTriggerPayload(noneForm).actions, []);
});

function makeActions(overrides = {}) {
  const env = makeEnv();
  env.CONFIG.statusEffects = [{ id: "bloodied", name: "Bloodied", img: "icons/b.svg" }];
  env.canvas = {
    tokens: {
      controlled: [
        {
          actor: {
            id: "a1",
            setFlag: async () => ["bloodied"],
            getFlag: () => [],
            toggleStatusEffect: async () => true,
            createEmbeddedDocuments: async () => [],
            deleteEmbeddedDocuments: async () => [],
            effects: []
          }
        }
      ]
    }
  };
  const dataManager = makeDataManager({
    triggers: [{ id: "t1", name: "T1", path: "hp", operator: "eq", value: 0, actions: [] }],
    conditions: [{ id: "c1", name: "C1", changes: [] }]
  });
  const renderCalls = [];
  const uiManager = {
    renderOpenWindows: () => { renderCalls.push(1); return true; },
    openDetail: (payload) => payload
  };
  const actions = new GMHubActions({ dataManager, uiManager, env, ...overrides });
  return { actions, dataManager, uiManager, env, renderCalls };
}

test("GMHubActions.notify/render/getStatus/resolveCondition", () => {
  const { actions, env } = makeActions();
  assert.equal(actions.notify("info", "K", "fallback"), "fallback");
  assert.deepEqual(env.notifications.info, ["fallback"]);
  assert.equal(actions.render(), true);
  assert.equal(actions.getStatus("bloodied").id, "bloodied");
  assert.equal(actions.resolveCondition(""), null);
  assert.equal(actions.resolveCondition("c1").name, "C1");
  assert.equal(actions.resolveCondition("bloodied").id, "bloodied");
  assert.equal(actions.resolveCondition("unknown").name, "unknown");
});

test("GMHubActions.notify: no-ops cleanly when notifications missing", () => {
  const env = makeEnv();
  env.ui = {};
  const actions = new GMHubActions({ dataManager: makeDataManager(), uiManager: { renderOpenWindows: () => false }, env });
  assert.equal(actions.notify("info", "K", "msg"), "msg");
});

test("export/import/refresh", async () => {
  const { actions, renderCalls } = makeActions();
  const textarea = { value: "" };
  const payload = actions.exportToTextarea(textarea);
  assert.ok(payload.includes("t1"));
  assert.equal(textarea.value, payload);

  textarea.value = JSON.stringify({ triggers: [{ id: "t2", path: "x", value: 1 }], conditions: [] });
  const imported = await actions.importFromTextarea(textarea);
  assert.equal(imported.triggers[0].id, "t2");
  assert.ok(renderCalls.length >= 1);

  textarea.value = "{not-json";
  assert.equal(await actions.importFromTextarea(textarea), null);
  assert.equal(actions.refresh(), true);
});

test("save/delete condition and trigger", async () => {
  const { actions, env } = makeActions();
  const badForm = makeForm({
    conditionId: { value: "" },
    statusId: { value: "" },
    conditionName: { value: "" },
    conditionImg: { value: "" },
    conditionDescription: { value: "" },
    applyTriggerId: { value: "" },
    removeTriggerId: { value: "" }
  });
  assert.equal(await actions.saveConditionFromForm(badForm), null);
  assert.ok(env.notifications.error.length);

  const goodForm = makeForm({
    conditionId: { value: "new-c" },
    statusId: { value: "" },
    conditionName: { value: "New" },
    conditionImg: { value: "" },
    conditionDescription: { value: "" },
    applyTriggerId: { value: "" },
    removeTriggerId: { value: "" }
  });
  assert.equal((await actions.saveConditionFromForm(goodForm)).id, "new-c");
  assert.equal(await actions.deleteCondition(""), null);
  assert.ok(await actions.deleteCondition("new-c"));

  const noPath = makeForm({
    triggerPathCustom: { value: "" },
    triggerPath: { value: "" },
    triggerName: { value: "X" },
    operator: { value: "eq" },
    value: { value: "1" },
    actionType: { value: ACTION_TYPES.NONE },
    actionCondition: { value: "" },
    comparePath: { value: "" },
    scope: { value: "all" },
    triggerId: { value: "tx" },
    notZero: { checked: false },
    macroId: { value: "" }
  });
  assert.equal(await actions.saveTriggerFromForm(noPath), null);

  const noneAction = makeForm({
    triggerPathCustom: { value: "" },
    triggerPath: { value: "hp.value" },
    triggerName: { value: "None" },
    operator: { value: "eq" },
    value: { value: "1" },
    actionType: { value: ACTION_TYPES.NONE },
    actionCondition: { value: "" },
    comparePath: { value: "" },
    scope: { value: "all" },
    triggerId: { value: "tn" },
    notZero: { checked: false },
    macroId: { value: "" }
  });
  assert.equal((await actions.saveTriggerFromForm(noneAction)).id, "tn");

  const noMacro = makeForm({
    triggerPathCustom: { value: "" },
    triggerPath: { value: "hp.value" },
    triggerName: { value: "M" },
    operator: { value: "eq" },
    value: { value: "1" },
    actionType: { value: ACTION_TYPES.RUN_MACRO },
    actionCondition: { value: "" },
    comparePath: { value: "" },
    scope: { value: "all" },
    triggerId: { value: "tm" },
    notZero: { checked: false },
    macroId: { value: "" }
  });
  assert.equal(await actions.saveTriggerFromForm(noMacro), null);

  const noCond = makeForm({
    triggerPathCustom: { value: "" },
    triggerPath: { value: "hp.value" },
    triggerName: { value: "A" },
    operator: { value: "eq" },
    value: { value: "1" },
    actionType: { value: ACTION_TYPES.APPLY_CONDITION },
    actionCondition: { value: "" },
    comparePath: { value: "" },
    scope: { value: "all" },
    triggerId: { value: "ta" },
    notZero: { checked: false },
    macroId: { value: "" }
  });
  assert.equal(await actions.saveTriggerFromForm(noCond), null);

  const goodTrig = makeForm({
    triggerPathCustom: { value: "" },
    triggerPath: { value: "hp.value" },
    triggerName: { value: "A" },
    operator: { value: "eq" },
    value: { value: "1" },
    actionType: { value: ACTION_TYPES.APPLY_CONDITION },
    actionCondition: { value: "bloodied" },
    comparePath: { value: "" },
    scope: { value: "all" },
    triggerId: { value: "ta2" },
    notZero: { checked: false },
    macroId: { value: "" }
  });
  assert.equal((await actions.saveTriggerFromForm(goodTrig)).id, "ta2");
  assert.equal(await actions.deleteTrigger(""), null);
  assert.ok(await actions.deleteTrigger("ta2"));
});

test("editCondition/editTrigger", () => {
  const { actions } = makeActions();
  assert.equal(actions.editCondition(""), null);
  assert.equal(actions.editCondition("missing"), null);
  assert.deepEqual(actions.editCondition("c1"), { itemType: "condition", item: { id: "c1", name: "C1", changes: [] } });
  assert.equal(actions.editTrigger(""), null);
  assert.equal(actions.editTrigger("missing"), null);
  assert.equal(actions.editTrigger("t1").itemType, "trigger");
});

test("selectedActors and apply/assign/unassign selected", async () => {
  const { actions, env } = makeActions();
  assert.equal(actions.selectedActors().length, 1);

  assert.deepEqual(await actions.applyToSelected("apply", ""), []);
  env.canvas.tokens.controlled = [];
  assert.deepEqual(await actions.applyToSelected("apply", "bloodied"), []);
  env.canvas.tokens.controlled = [
    { actor: { id: "a1", toggleStatusEffect: async () => true, effects: [], setFlag: async () => [], getFlag: () => [], createEmbeddedDocuments: async () => [], deleteEmbeddedDocuments: async () => [] } }
  ];
  assert.equal((await actions.applyToSelected("apply", "bloodied")).length, 1);

  assert.deepEqual(await actions.assignToSelected(""), []);
  env.canvas.tokens.controlled = [];
  assert.deepEqual(await actions.assignToSelected("bloodied"), []);
  env.canvas.tokens.controlled = [
    { actor: { id: "a1", setFlag: async () => ["bloodied"], getFlag: () => [], effects: [] } }
  ];
  assert.equal((await actions.assignToSelected("bloodied")).length, 1);

  assert.deepEqual(await actions.unassignFromSelected(""), []);
  env.canvas.tokens.controlled = [];
  assert.deepEqual(await actions.unassignFromSelected("bloodied"), []);
  env.canvas.tokens.controlled = [
    {
      actor: {
        id: "a1",
        setFlag: async () => [],
        unsetFlag: async () => {},
        getFlag: () => ["bloodied"],
        flags: { "ld-triggerz": { assignedConditions: ["bloodied"] } },
        effects: []
      }
    }
  ];
  assert.equal((await actions.unassignFromSelected("bloodied")).length, 1);

  // token without actor uses token itself
  env.canvas.tokens.controlled = [{ id: "tok", document: { actor: { id: "nested" } } }];
  assert.equal(actions.selectedActors()[0].id, "nested");
  env.canvas.tokens.controlled = [{ id: "bare" }];
  assert.equal(actions.selectedActors()[0].id, "bare");
});

test("GMHubActions constructs default ConditionAdapter when none provided", () => {
  const env = makeEnv();
  const actions = new GMHubActions({ dataManager: makeDataManager(), uiManager: { renderOpenWindows: () => false }, env });
  assert.ok(actions.conditionAdapter);
});
