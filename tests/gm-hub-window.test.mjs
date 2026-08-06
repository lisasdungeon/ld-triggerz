import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { installDom, resetDocumentBody } from "./helpers/dom-setup.mjs";
import { createGMHubWindowClass } from "../src/windows/GMHubWindow.js";
import { createApplicationApi, makeDataManager, makeEnv } from "./helpers/mock-foundry.mjs";

installDom();
beforeEach(() => resetDocumentBody());

test("GMHubWindow: prepares context, binds events, clears hub on close", async () => {
  const GMHubWindow = createGMHubWindowClass(createApplicationApi());
  const env = makeEnv();
  const dataManager = makeDataManager({
    triggers: [{ id: "t1", name: "T1", path: "hp", operator: "eq", value: 0, actions: [] }],
    conditions: []
  });
  const clearCalls = [];
  const uiManager = {
    clearGMHub: (app) => clearCalls.push(app),
    renderOpenWindows: () => true
  };
  const hub = new GMHubWindow({
    dataManager,
    conditionAdapter: {},
    uiManager,
    env
  });
  const ctx = await hub._prepareContext({});
  assert.equal(ctx.triggerCount, 1);
  assert.equal(ctx.mode, "GM");

  hub.element = document.createElement("div");
  hub.element.innerHTML = `<textarea data-ld-triggerz-export></textarea>`;
  assert.doesNotThrow(() => hub._onRender());

  await hub.close({});
  assert.equal(clearCalls[0], hub);
  assert.equal(hub._closed, true);
});
