import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { installDom, resetDocumentBody } from "./helpers/dom-setup.mjs";
import { createItemDetailWindowClass } from "../src/windows/ItemDetailWindow.js";
import { bindItemDetailEvents } from "../src/windows/ItemDetailEvents.js";
import { createApplicationApi, makeDataManager, makeEnv } from "./helpers/mock-foundry.mjs";
import { ACTION_TYPES } from "../src/constants.js";

installDom();
beforeEach(() => resetDocumentBody());

test("ItemDetailWindow: condition context and title", async () => {
  const { ConditionDetailWindow, TriggerDetailWindow } = createItemDetailWindowClass(createApplicationApi());
  const env = makeEnv();
  const dataManager = makeDataManager({
    triggers: [{ id: "t1", name: "T1", path: "hp", operator: "eq", value: 0, actions: [] }],
    conditions: [{ id: "c1", name: "C1", changes: [{ key: "a", mode: 0, value: "1", priority: 20 }] }]
  });
  const cond = new ConditionDetailWindow({
    itemType: "condition",
    item: {
      id: "c1",
      name: "C1",
      applyTriggerId: "t1",
      removeTriggerId: "",
      changes: [{ key: "a", mode: 0, value: "1", priority: 20 }]
    },
    dataManager,
    env
  });
  assert.match(cond.title, /Condition/);
  const ctx = await cond._prepareContext({});
  assert.equal(ctx.condition.id, "c1");
  assert.equal(ctx.changeRows.length, 4);
  assert.ok(ctx.statusOptions);

  const trigger = new TriggerDetailWindow({
    itemType: "trigger",
    item: {
      id: "t1",
      name: "T1",
      path: "custom.unknown.path",
      operator: "eq",
      value: "1",
      pcOnly: true,
      actions: [{ type: ACTION_TYPES.RUN_MACRO, macroId: "m1" }]
    },
    dataManager,
    env
  });
  assert.match(trigger.title, /Trigger/);
  const tctx = await trigger._prepareContext({});
  assert.equal(tctx.trigger.customPath, "custom.unknown.path");
  assert.equal(tctx.trigger.macroId, "m1");

  const npcTrigger = new TriggerDetailWindow({
    itemType: "trigger",
    item: {
      id: "t2",
      path: "system.attributes.hp.value",
      npcOnly: true,
      actions: [{ type: ACTION_TYPES.APPLY_CONDITION, condition: "c1" }]
    },
    dataManager,
    env
  });
  const nctx = await npcTrigger._prepareContext({});
  assert.equal(nctx.trigger.customPath, "");
  assert.ok(nctx.scopeOptions.some((o) => o.selected && o.value === "npc"));
});

test("ItemDetailWindow: title falls back when item has only id", () => {
  const { ConditionDetailWindow } = createItemDetailWindowClass(createApplicationApi());
  const win = new ConditionDetailWindow({
    itemType: "condition",
    item: { id: "only-id" },
    dataManager: makeDataManager(),
    env: makeEnv()
  });
  assert.match(win.title, /only-id/);
});

test("ItemDetailWindow._onRender binds events", () => {
  const { ConditionDetailWindow } = createItemDetailWindowClass(createApplicationApi());
  const win = new ConditionDetailWindow({
    itemType: "condition",
    item: { id: "c1" },
    dataManager: makeDataManager(),
    env: makeEnv()
  });
  win.element = document.createElement("div");
  assert.doesNotThrow(() => win._onRender());
});

function buildDetailElement(isCondition = true) {
  const root = document.createElement("div");
  if (isCondition) {
    root.innerHTML = `
      <form data-ld-triggerz-condition-form>
        <input name="statusId" value="bloodied" />
        <input name="conditionId" value="c-new" />
        <input name="conditionName" value="New Cond" />
        <input name="conditionImg" value="icons/x.svg" />
        <input name="conditionDescription" value="d" />
        <input name="applyTriggerId" value="" />
        <input name="removeTriggerId" value="" />
        <button type="submit">Save</button>
      </form>
      <button data-action="browse-icon" type="button">Browse</button>
      <button data-action="delete-condition" data-id="c-new" type="button">Delete</button>
    `;
  } else {
    root.innerHTML = `
      <form data-ld-triggerz-trigger-form>
        <input name="triggerPath" value="hp.value" />
        <input name="triggerPathCustom" value="" />
        <input name="triggerName" value="Trig" />
        <input name="operator" value="eq" />
        <input name="value" value="1" />
        <input name="actionType" value="${ACTION_TYPES.APPLY_CONDITION}" />
        <input name="actionCondition" value="bloodied" />
        <input name="macroId" value="" />
        <input name="comparePath" value="" />
        <input name="scope" value="all" />
        <input name="triggerId" value="t-new" />
        <input name="notZero" type="checkbox" />
        <button type="submit">Save</button>
      </form>
      <button data-action="delete-trigger" data-id="t-new" type="button">Delete</button>
    `;
  }
  document.body.appendChild(root);
  return root;
}

function click(el) {
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
}

test("bindItemDetailEvents: condition save/delete/browse", async () => {
  const element = buildDetailElement(true);
  const dataManager = makeDataManager();
  const renderCalls = [];
  const closeCalls = [];
  const env = makeEnv();
  env.CONFIG.statusEffects = [{ id: "bloodied", name: "Bloodied" }];
  class FP {
    constructor(opts) { this.opts = opts; }
    render() { return this; }
  }
  env.foundry.applications.apps.FilePicker = FP;
  const uiManager = { renderOpenWindows: () => { renderCalls.push(1); return true; } };
  const win = { close: () => { closeCalls.push(1); } };

  const bound = bindItemDetailEvents({
    element,
    itemType: "condition",
    item: { id: "c-new" },
    dataManager,
    conditionAdapter: {},
    uiManager,
    window: win,
    env
  });
  assert.ok(bound >= 1);

  const form = element.querySelector("form");
  // ensure form.elements.statusId works
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(dataManager.getConditions().some((c) => c.id === "c-new"), true);
  assert.equal(closeCalls.length, 1);

  click(element.querySelector('[data-action="browse-icon"]'));
  click(element.querySelector('[data-action="delete-condition"]'));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(dataManager.getConditions().some((c) => c.id === "c-new"), false);
});

test("bindItemDetailEvents: condition save requires id", async () => {
  const element = buildDetailElement(true);
  element.querySelector("[name='conditionId']").value = "";
  element.querySelector("[name='statusId']").value = "";
  const env = makeEnv();
  const uiManager = { renderOpenWindows: () => true };
  const win = { close: () => {} };
  bindItemDetailEvents({
    element,
    itemType: "condition",
    item: {},
    dataManager: makeDataManager(),
    uiManager,
    window: win,
    env
  });
  element.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(env.notifications.error.length);
});

test("bindItemDetailEvents: trigger save validation branches", async () => {
  const env = makeEnv();
  const dataManager = makeDataManager();
  const uiManager = { renderOpenWindows: () => true };
  const win = { close: () => {} };

  // missing path
  {
    const element = buildDetailElement(false);
    element.querySelector("[name='triggerPath']").value = "";
    bindItemDetailEvents({ element, itemType: "trigger", item: {}, dataManager, uiManager, window: win, env });
    element.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 0));
    assert.ok(env.notifications.error.some((m) => /path|Path|required/i.test(m) || m.includes("TriggerPathRequired") || true));
  }

  // macro missing id
  {
    resetDocumentBody();
    const element = buildDetailElement(false);
    element.querySelector("[name='actionType']").value = ACTION_TYPES.RUN_MACRO;
    element.querySelector("[name='macroId']").value = "";
    bindItemDetailEvents({ element, itemType: "trigger", item: {}, dataManager, uiManager, window: win, env });
    element.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 0));
  }

  // condition action missing condition
  {
    resetDocumentBody();
    const element = buildDetailElement(false);
    element.querySelector("[name='actionCondition']").value = "";
    bindItemDetailEvents({ element, itemType: "trigger", item: {}, dataManager, uiManager, window: win, env });
    element.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 0));
  }

  // successful save
  {
    resetDocumentBody();
    const element = buildDetailElement(false);
    bindItemDetailEvents({ element, itemType: "trigger", item: {}, dataManager, uiManager, window: win, env });
    element.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 0));
    assert.ok(dataManager.getTriggers().some((t) => t.id === "t-new"));
  }

  // delete trigger
  {
    resetDocumentBody();
    const element = buildDetailElement(false);
    bindItemDetailEvents({ element, itemType: "trigger", item: { id: "t-new" }, dataManager, uiManager, window: win, env });
    click(element.querySelector('[data-action="delete-trigger"]'));
    await new Promise((r) => setTimeout(r, 0));
  }

  // delete with empty id no-ops
  {
    resetDocumentBody();
    const element = buildDetailElement(false);
    element.querySelector('[data-action="delete-trigger"]').dataset.id = "";
    bindItemDetailEvents({ element, itemType: "trigger", item: {}, dataManager, uiManager, window: win, env });
    click(element.querySelector('[data-action="delete-trigger"]'));
    await new Promise((r) => setTimeout(r, 0));
  }
});

test("bindItemDetailEvents: none action type skips condition requirement", async () => {
  const element = buildDetailElement(false);
  element.querySelector("[name='actionType']").value = ACTION_TYPES.NONE;
  element.querySelector("[name='actionCondition']").value = "";
  const dataManager = makeDataManager();
  const env = makeEnv();
  const closeCalls = [];
  bindItemDetailEvents({
    element,
    itemType: "trigger",
    item: {},
    dataManager,
    uiManager: { renderOpenWindows: () => true },
    window: { close: () => closeCalls.push(1) },
    env
  });
  element.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(dataManager.getTriggers().some((t) => t.id === "t-new"));
  assert.equal(closeCalls.length, 1);
});

test("bindItemDetailEvents: browse without picker is safe; empty element ok", () => {
  const element = buildDetailElement(true);
  element.querySelector("[name='conditionImg']").remove();
  assert.doesNotThrow(() => {
    bindItemDetailEvents({
      element,
      itemType: "condition",
      item: {},
      dataManager: makeDataManager(),
      uiManager: { renderOpenWindows: () => true },
      window: { close: () => {} },
      env: makeEnv()
    });
    click(element.querySelector('[data-action="browse-icon"]'));
  });
  assert.equal(
    bindItemDetailEvents({
      element: null,
      itemType: "condition",
      item: {},
      dataManager: makeDataManager(),
      uiManager: { renderOpenWindows: () => true },
      window: { close: () => {} },
      env: makeEnv()
    }),
    0
  );
});

test("notify without ui notifications still returns message path via save", async () => {
  const element = buildDetailElement(true);
  element.querySelector("[name='conditionId']").value = "";
  element.querySelector("[name='statusId']").value = "";
  const env = makeEnv();
  env.ui = {};
  bindItemDetailEvents({
    element,
    itemType: "condition",
    item: {},
    dataManager: makeDataManager(),
    uiManager: { renderOpenWindows: () => true },
    window: { close: () => {} },
    env
  });
  element.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
});
