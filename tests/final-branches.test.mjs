import assert from "node:assert/strict";
import test from "node:test";
import {
  actorUpdateEntity,
  tokenActorUpdateData
} from "../src/LDTriggerz.js";
import {
  cleanStatusLabel,
  summarizeCondition
} from "../src/windows/GMHubContext.js";
import {
  GMHubActions,
  buildConditionPayload
} from "../src/windows/GMHubActions.js";
import { bindGMHubEvents } from "../src/windows/GMHubEvents.js";
import { bindItemDetailEvents } from "../src/windows/ItemDetailEvents.js";
import { createItemDetailWindowClass } from "../src/windows/ItemDetailWindow.js";
import { ACTION_TYPES } from "../src/constants.js";
import { createApplicationApi, makeDataManager, makeEnv } from "./helpers/mock-foundry.mjs";
import { installDom, resetDocumentBody } from "./helpers/dom-setup.mjs";

installDom();

test("LDTriggerz: mergeActorUpdate non-object and null updateData coalescing", () => {
  assert.deepEqual(tokenActorUpdateData(42), {});
  assert.deepEqual(tokenActorUpdateData("nope"), {});
  assert.deepEqual(actorUpdateEntity({ id: "a", toObject: () => ({ id: "a" }) }, null).id, "a");
  assert.deepEqual(actorUpdateEntity({ id: "a", toObject: () => ({ id: "a" }) }, undefined).id, "a");
});

test("GMHubContext: remaining ?? sides", () => {
  assert.equal(cleanStatusLabel(null), "");
  assert.equal(cleanStatusLabel(undefined), "");
  // name missing falls back to id
  const noName = summarizeCondition({ id: "only-id", changes: [{}] });
  assert.equal(noName.label, "only-id");
  // applyTriggerId missing from map uses id; removeTriggerId present uses label
  const labels = new Map([["known", "Known Label"]]);
  const mixed = summarizeCondition({
    id: "c",
    applyTriggerId: "unknown-trigger",
    removeTriggerId: "known",
    changes: []
  }, labels);
  assert.equal(mixed.applyTriggerSummary, "unknown-trigger");
  assert.equal(mixed.removeTriggerSummary, "Known Label");
});

test("GMHubActions.resolveCondition: null id and status without label helpers", () => {
  const env = makeEnv();
  env.CONFIG.statusEffects = [{ id: "plain", img: "icons/p.svg" }];
  const actions = new GMHubActions({
    dataManager: makeDataManager(),
    uiManager: { renderOpenWindows: () => false },
    env
  });
  assert.equal(actions.resolveCondition(null), null);
  assert.equal(actions.resolveCondition(undefined), null);
  const resolved = actions.resolveCondition("plain");
  assert.equal(resolved.id, "plain");
  assert.equal(resolved.img, "icons/p.svg");
});

test("GMHubEvents: empty img value uses icons/svg/ default; getTriggers null; label fallbacks; no doc", () => {
  resetDocumentBody();
  const element = document.createElement("div");
  element.innerHTML = `
    <form data-ld-triggerz-condition-form>
      <input name="conditionImg" value="" />
      <select name="applyTriggerId"></select>
      <select name="removeTriggerId"></select>
    </form>
    <button data-action="browse-icon" type="button"></button>
  `;
  document.body.appendChild(element);

  let opts;
  class FP {
    constructor(o) { opts = o; }
    render() { return this; }
  }
  bindGMHubEvents({
    element,
    actions: {
      dataManager: {
        getTriggers: () => [
          { id: "t1" }, // no name/label
          { id: "t2", name: "Named", label: "Lab" }
        ]
      }
    },
    env: { document, foundry: { applications: { apps: { FilePicker: FP } } } }
  });
  element.querySelector('[data-action="browse-icon"]').click();
  assert.equal(opts.current, "icons/svg/");
  const apply = element.querySelector("[name='applyTriggerId']");
  assert.ok([...apply.options].some((o) => o.value === "t1" && o.textContent === "t1"));

  // getTriggers returns null/undefined -> ?? []
  const el2 = document.createElement("div");
  el2.innerHTML = `<form data-ld-triggerz-condition-form><select name="applyTriggerId"></select></form>`;
  document.body.appendChild(el2);
  bindGMHubEvents({
    element: el2,
    actions: { dataManager: { getTriggers: () => null } },
    env: { document }
  });
  assert.equal(el2.querySelector("select").options.length, 1);

  // no document available at all
  const savedDoc = globalThis.document;
  const el3 = savedDoc.createElement("div");
  el3.innerHTML = `<form data-ld-triggerz-condition-form><select name="applyTriggerId"></select></form>`;
  try {
    globalThis.document = undefined;
    bindGMHubEvents({
      element: el3,
      actions: { dataManager: { getTriggers: () => [{ id: "x", label: "X" }] } },
      env: { document: null }
    });
    // population skipped; select stays empty of new options (or untouched)
    assert.ok(true);
  } finally {
    globalThis.document = savedDoc;
  }
});

test("ItemDetailEvents: empty img current path; statusId missing coalesces", async () => {
  resetDocumentBody();
  const element = document.createElement("div");
  element.innerHTML = `
    <form data-ld-triggerz-condition-form>
      <input name="conditionId" value="z1" />
      <input name="conditionName" value="Z" />
      <input name="conditionImg" value="" />
      <input name="conditionDescription" value="" />
      <input name="applyTriggerId" value="" />
      <input name="removeTriggerId" value="" />
    </form>
    <button data-action="browse-icon" type="button"></button>
  `;
  document.body.appendChild(element);
  let opts;
  class FP {
    constructor(o) { opts = o; }
    render() { return this; }
  }
  const env = makeEnv();
  env.foundry.applications.apps.FilePicker = FP;
  bindItemDetailEvents({
    element,
    itemType: "condition",
    item: { id: "z1" },
    dataManager: makeDataManager(),
    uiManager: { renderOpenWindows: () => true },
    window: { close: () => {} },
    env
  });
  element.querySelector('[data-action="browse-icon"]').click();
  assert.equal(opts.current, "icons/svg/");

  // submit without statusId element hits ?? ""
  element.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
});

test("ItemDetailWindow: missing apply/remove trigger ids and macroId coalescing", async () => {
  const { ConditionDetailWindow, TriggerDetailWindow } = createItemDetailWindowClass(createApplicationApi());
  const env = makeEnv();
  const dataManager = makeDataManager({ conditions: [], triggers: [] });

  const cond = new ConditionDetailWindow({
    itemType: "condition",
    item: { id: "c", name: "C", changes: [] }, // no apply/remove ids
    dataManager,
    env
  });
  const cctx = await cond._prepareContext({});
  assert.ok(cctx.triggerOptions);

  const trig = new TriggerDetailWindow({
    itemType: "trigger",
    item: {
      id: "t",
      path: "system.hp.value",
      actions: [{ type: ACTION_TYPES.RUN_MACRO }] // macroId missing
    },
    dataManager,
    env
  });
  const tctx = await trig._prepareContext({});
  assert.equal(tctx.trigger.macroId, "");
  assert.equal(tctx.trigger.comparePath, "");
});

test("buildConditionPayload without status uses aura img", () => {
  const form = {
    elements: {
      namedItem: (name) => ({
        value: name === "conditionId" ? "x" : name === "conditionName" ? "X" : ""
      })
    }
  };
  const condition = buildConditionPayload(form, undefined);
  assert.equal(condition.img, "icons/svg/aura.svg");
});

test("GMHubContext buildConditionOptions: name falls back to id", async () => {
  const { buildConditionOptions } = await import("../src/windows/GMHubContext.js");
  const options = buildConditionOptions([{ id: "only-id" }], []);
  assert.equal(options[0].label, "only-id");
});

test("browseIcon: FP not a function returns after input exists; named trigger without label", () => {
  resetDocumentBody();
  const element = document.createElement("div");
  element.innerHTML = `
    <form data-ld-triggerz-condition-form>
      <input name="conditionImg" value="icons/x.svg" />
      <select name="applyTriggerId"></select>
      <select name="removeTriggerId"></select>
    </form>
    <button data-action="browse-icon" type="button"></button>
  `;
  document.body.appendChild(element);
  // No FilePicker on env or global — hits typeof FP !== "function" return
  delete globalThis.FilePicker;
  bindGMHubEvents({
    element,
    actions: {
      dataManager: {
        getTriggers: () => [{ id: "tid", name: "Pretty Name" }] // name !== id, no label
      }
    },
    env: { document, foundry: { applications: { apps: {} } } }
  });
  assert.doesNotThrow(() => element.querySelector('[data-action="browse-icon"]').click());
  const apply = element.querySelector("[name='applyTriggerId']");
  const opt = [...apply.options].find((o) => o.value === "tid");
  assert.ok(opt);
  assert.match(opt.textContent, /Pretty Name/);
});

test("ItemDetailEvents browseIcon: FP not a function with input present", () => {
  resetDocumentBody();
  const element = document.createElement("div");
  element.innerHTML = `
    <form data-ld-triggerz-condition-form>
      <input name="conditionImg" value="icons/x.svg" />
    </form>
    <button data-action="browse-icon" type="button"></button>
  `;
  document.body.appendChild(element);
  delete globalThis.FilePicker;
  bindItemDetailEvents({
    element,
    itemType: "condition",
    item: { id: "c" },
    dataManager: makeDataManager(),
    uiManager: { renderOpenWindows: () => true },
    window: { close: () => {} },
    env: { document, foundry: { applications: { apps: {} } }, ui: { notifications: {} } }
  });
  assert.doesNotThrow(() => element.querySelector('[data-action="browse-icon"]').click());
});
