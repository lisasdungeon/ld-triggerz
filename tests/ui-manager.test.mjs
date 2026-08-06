import assert from "node:assert/strict";
import test from "node:test";
import { UIManager, forceRenderApplication } from "../src/UIManager.js";
import { createApplicationApi, makeDataManager, makeEnv } from "./helpers/mock-foundry.mjs";

test("forceRenderApplication: calls render with force true", () => {
  const calls = [];
  const app = { render: (opts) => { calls.push(opts); return app; } };
  assert.equal(forceRenderApplication(app), app);
  assert.deepEqual(calls, [{ force: true }]);
});

test("UIManager.openGMHub: creates hub, reuses it, force recreates", () => {
  const env = makeEnv();
  const dataManager = makeDataManager();
  const ui = new UIManager({ env, dataManager, conditionAdapter: {} });
  const hub1 = ui.openGMHub();
  assert.ok(hub1);
  assert.equal(ui.gmHub, hub1);
  const hub1Again = ui.openGMHub();
  assert.equal(hub1Again, hub1);
  assert.equal(hub1._broughtToTop, true);

  const hub2 = ui.openGMHub({ force: true });
  assert.notEqual(hub2, hub1);
  assert.equal(hub1._closed, true);
  assert.equal(ui.gmHub, hub2);
});

test("UIManager.clearGMHub: only clears when app matches", () => {
  const env = makeEnv();
  const ui = new UIManager({ env, dataManager: makeDataManager(), conditionAdapter: {} });
  const hub = ui.openGMHub();
  ui.clearGMHub({});
  assert.equal(ui.gmHub, hub);
  ui.clearGMHub(hub);
  assert.equal(ui.gmHub, null);
});

test("UIManager.openDetail: opens condition and trigger detail windows", () => {
  const env = makeEnv();
  const ui = new UIManager({ env, dataManager: makeDataManager(), conditionAdapter: {} });
  const condWin = ui.openDetail({ itemType: "condition", item: { id: "c1", name: "C" } });
  assert.equal(condWin.itemType, "condition");
  const trigWin = ui.openDetail({ itemType: "trigger", item: { id: "t1", path: "hp" } });
  assert.equal(trigWin.itemType, "trigger");
});

test("UIManager.renderOpenWindows: false when closed, true when open", () => {
  const env = makeEnv();
  const ui = new UIManager({ env, dataManager: makeDataManager(), conditionAdapter: {} });
  assert.equal(ui.renderOpenWindows(), false);
  ui.openGMHub();
  assert.equal(ui.renderOpenWindows(), true);
});

test("UIManager: accepts injected window classes", () => {
  class FakeHub {
    constructor(opts) { this.opts = opts; }
    render() { return this; }
    bringToTop() { this.top = true; return this; }
    close() { this.closed = true; }
  }
  class FakeDetail {
    constructor(opts) { this.opts = opts; this.itemType = opts.itemType; }
    render() { return this; }
  }
  const ui = new UIManager({
    env: makeEnv(),
    dataManager: makeDataManager(),
    conditionAdapter: {},
    windowClass: FakeHub,
    detailWindowClasses: {
      ConditionDetailWindow: FakeDetail,
      TriggerDetailWindow: FakeDetail
    }
  });
  assert.ok(ui.openGMHub() instanceof FakeHub);
  assert.ok(ui.openDetail({ itemType: "condition", item: {} }) instanceof FakeDetail);
  assert.equal(createApplicationApi().ApplicationV2.name, "MockApplicationV2");
});
