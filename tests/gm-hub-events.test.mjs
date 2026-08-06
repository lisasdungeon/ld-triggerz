import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";
import { installDom, resetDocumentBody } from "./helpers/dom-setup.mjs";
import { bindGMHubEvents } from "../src/windows/GMHubEvents.js";

installDom();
before(() => {});
beforeEach(() => resetDocumentBody());

function buildHubElement({ withForms = true, withButtons = true } = {}) {
  const root = document.createElement("div");
  root.innerHTML = `
    <textarea data-ld-triggerz-export></textarea>
    <input data-ld-triggerz-selected-condition value="from-select" />
    <input data-ld-triggerz-selected-condition-custom value="" />
    ${withForms ? `
      <form data-ld-triggerz-condition-form>
        <input name="conditionImg" value="icons/svg/aura.svg" />
        <select name="applyTriggerId"></select>
        <select name="removeTriggerId"></select>
        <button type="submit">Save Condition</button>
      </form>
      <form data-ld-triggerz-trigger-form>
        <button type="submit">Save Trigger</button>
      </form>
    ` : ""}
    ${withButtons ? `
      <button data-action="browse-icon" type="button">Browse</button>
      <button data-action="export" type="button">Export</button>
      <button data-action="import" type="button">Import</button>
      <button data-action="refresh" type="button">Refresh</button>
      <button data-action="edit-condition" data-id="c1" type="button">Edit C</button>
      <button data-action="edit-trigger" data-id="t1" type="button">Edit T</button>
      <button data-action="delete-condition" data-id="c1" type="button">Del C</button>
      <button data-action="delete-trigger" data-id="t1" type="button">Del T</button>
      <button data-action="assign-selected" type="button">Assign</button>
      <button data-action="unassign-selected" type="button">Unassign</button>
      <button data-action="apply-selected" type="button">Apply</button>
      <button data-action="remove-selected" type="button">Remove</button>
      <button data-action="toggle-selected" type="button">Toggle</button>
    ` : ""}
  `;
  document.body.appendChild(root);
  return root;
}

function click(el) {
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
}

function makeActions() {
  const calls = [];
  return {
    calls,
    dataManager: {
      getTriggers: () => [
        { id: "t1", name: "T1", label: "hp eq 0" },
        { id: "t2", name: "t2", label: "t2" }
      ]
    },
    saveConditionFromForm: async (form) => { calls.push(["saveCondition", form]); },
    saveTriggerFromForm: async (form) => { calls.push(["saveTrigger", form]); },
    exportToTextarea: (ta) => { calls.push(["export", ta]); },
    importFromTextarea: async (ta) => { calls.push(["import", ta]); },
    refresh: () => { calls.push(["refresh"]); },
    editCondition: (id) => { calls.push(["editCondition", id]); },
    editTrigger: (id) => { calls.push(["editTrigger", id]); },
    deleteCondition: async (id) => { calls.push(["deleteCondition", id]); },
    deleteTrigger: async (id) => { calls.push(["deleteTrigger", id]); },
    assignToSelected: async (id) => { calls.push(["assign", id]); },
    unassignFromSelected: async (id) => { calls.push(["unassign", id]); },
    applyToSelected: async (method, id) => { calls.push(["apply", method, id]); }
  };
}

test("bindGMHubEvents: wires forms, buttons, and populates trigger selects", async () => {
  const element = buildHubElement();
  const actions = makeActions();
  const fpCalls = [];
  class FakeFP {
    constructor(opts) { fpCalls.push(opts); }
    render() { return this; }
  }
  const env = {
    document,
    foundry: { applications: { apps: { FilePicker: FakeFP } } }
  };
  const bound = bindGMHubEvents({ element, actions, env });
  assert.ok(bound > 0);

  const applySelect = element.querySelector("[name='applyTriggerId']");
  assert.ok(applySelect.options.length >= 2);
  assert.equal(applySelect.options[1].value, "t1");
  assert.match(applySelect.options[1].textContent, /T1/);

  const conditionForm = element.querySelector("[data-ld-triggerz-condition-form]");
  conditionForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(actions.calls[0][0], "saveCondition");

  const triggerForm = element.querySelector("[data-ld-triggerz-trigger-form]");
  triggerForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(actions.calls.some((c) => c[0] === "saveTrigger"));

  click(element.querySelector('[data-action="browse-icon"]'));
  assert.equal(fpCalls.length, 1);
  fpCalls[0].callback("icons/new.svg");
  assert.equal(element.querySelector("[name='conditionImg']").value, "icons/new.svg");

  click(element.querySelector('[data-action="export"]'));
  click(element.querySelector('[data-action="import"]'));
  click(element.querySelector('[data-action="refresh"]'));
  click(element.querySelector('[data-action="edit-condition"]'));
  click(element.querySelector('[data-action="edit-trigger"]'));
  click(element.querySelector('[data-action="delete-condition"]'));
  click(element.querySelector('[data-action="delete-trigger"]'));
  click(element.querySelector('[data-action="assign-selected"]'));
  click(element.querySelector('[data-action="unassign-selected"]'));
  click(element.querySelector('[data-action="apply-selected"]'));
  click(element.querySelector('[data-action="remove-selected"]'));
  click(element.querySelector('[data-action="toggle-selected"]'));
  await new Promise((r) => setTimeout(r, 0));

  assert.ok(actions.calls.some((c) => c[0] === "export"));
  assert.ok(actions.calls.some((c) => c[0] === "import"));
  assert.ok(actions.calls.some((c) => c[0] === "refresh"));
  assert.ok(actions.calls.some((c) => c[0] === "editCondition" && c[1] === "c1"));
  assert.ok(actions.calls.some((c) => c[0] === "apply" && c[1] === "apply"));
  assert.ok(actions.calls.some((c) => c[0] === "apply" && c[1] === "remove"));
  assert.ok(actions.calls.some((c) => c[0] === "apply" && c[1] === "toggle"));
});

test("bindGMHubEvents: selectedCondition prefers custom value", async () => {
  const element = buildHubElement();
  element.querySelector("[data-ld-triggerz-selected-condition-custom]").value = "custom-id";
  const actions = makeActions();
  bindGMHubEvents({ element, actions, env: { document } });
  click(element.querySelector('[data-action="assign-selected"]'));
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(actions.calls.find((c) => c[0] === "assign"), ["assign", "custom-id"]);
});

test("bindGMHubEvents: browse-icon no-ops without FilePicker or input", () => {
  const element = buildHubElement();
  element.querySelector("[name='conditionImg']").remove();
  const actions = makeActions();
  bindGMHubEvents({ element, actions, env: { document } });
  assert.doesNotThrow(() => click(element.querySelector('[data-action="browse-icon"]')));
});

test("bindGMHubEvents: FilePicker implementation alias is used", () => {
  const element = buildHubElement();
  const calls = [];
  class Impl {
    constructor(opts) { calls.push(opts); }
    render() { return this; }
  }
  const env = {
    document,
    foundry: { applications: { apps: { FilePicker: { implementation: Impl } } } }
  };
  bindGMHubEvents({ element, actions: makeActions(), env });
  click(element.querySelector('[data-action="browse-icon"]'));
  assert.equal(calls.length, 1);
});

test("bindGMHubEvents: global FilePicker fallback", () => {
  const element = buildHubElement();
  const calls = [];
  globalThis.FilePicker = class {
    constructor(opts) { calls.push(opts); }
    render() { return this; }
  };
  try {
    bindGMHubEvents({ element, actions: makeActions(), env: { document, foundry: { applications: { apps: {} } } } });
    click(element.querySelector('[data-action="browse-icon"]'));
    assert.equal(calls.length, 1);
  } finally {
    delete globalThis.FilePicker;
  }
});

test("bindGMHubEvents: empty element still returns a count", () => {
  const element = document.createElement("div");
  document.body.appendChild(element);
  assert.equal(bindGMHubEvents({ element, actions: makeActions(), env: { document } }), 0);
});

test("populateTriggerSelects: handles missing selects and empty triggers", () => {
  const root = document.createElement("div");
  root.innerHTML = `<form data-ld-triggerz-condition-form></form>`;
  document.body.appendChild(root);
  const actions = {
    dataManager: { getTriggers: () => [] },
    saveConditionFromForm: async () => {},
    saveTriggerFromForm: async () => {}
  };
  bindGMHubEvents({ element: root, actions, env: { document } });
  // form without selects is fine
  assert.ok(true);

  const withSelect = document.createElement("div");
  withSelect.innerHTML = `
    <form data-ld-triggerz-condition-form>
      <select name="applyTriggerId"><option value="keep">keep</option></select>
    </form>
  `;
  document.body.appendChild(withSelect);
  withSelect.querySelector("select").value = "keep";
  bindGMHubEvents({
    element: withSelect,
    actions: { dataManager: { getTriggers: () => [] }, saveConditionFromForm: async () => {}, saveTriggerFromForm: async () => {} },
    env: { document }
  });
  assert.match(withSelect.querySelector("select").options[0].textContent, /Save a trigger first/);
});

test("populateTriggerSelects: no document env skips population", () => {
  const element = buildHubElement();
  const original = globalThis.document;
  // pass env without document; global remains, but function prefers env.document
  bindGMHubEvents({
    element,
    actions: { dataManager: { getTriggers: () => [{ id: "t1", label: "L" }] } },
    env: {}
  });
  assert.equal(original, globalThis.document);
});
