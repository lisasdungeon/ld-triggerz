import assert from "node:assert/strict";
import test from "node:test";
import {
  createControlGroup,
  createOpenHubTool,
  injectControlGroup,
  registerSceneControlHook,
  sceneControlEnabled
} from "../src/hooks/UIHooks.js";
import { MODULE_ID, SETTING_KEYS } from "../src/constants.js";

test("createOpenHubTool: builds tool and opens hub when active", () => {
  const calls = [];
  const triggerz = { uiManager: { openGMHub: () => { calls.push("open"); } } };
  const env = { game: { i18n: { has: () => false } } };
  const tool = createOpenHubTool(triggerz, env);
  assert.equal(tool.name, "openHub");
  assert.equal(tool.button, true);
  tool.onChange(false);
  assert.equal(calls.length, 0);
  tool.onChange(true);
  assert.deepEqual(calls, ["open"]);
});

test("createControlGroup: array vs object tool maps", () => {
  const tool = { name: "openHub" };
  const asArray = createControlGroup(tool, []);
  assert.deepEqual(asArray.tools, [tool]);
  const asObject = createControlGroup(tool, {});
  assert.deepEqual(asObject.tools, { openHub: tool });
  assert.equal(asArray.name, MODULE_ID);
});

test("injectControlGroup: pushes, replaces, and assigns by shape", () => {
  const group = { name: MODULE_ID, tools: [] };
  const list = [{ name: "tokens" }];
  injectControlGroup(list, group);
  assert.equal(list.length, 2);
  const replacement = { name: MODULE_ID, tools: ["x"] };
  injectControlGroup(list, replacement);
  assert.equal(list.length, 2);
  assert.equal(list[1].tools[0], "x");

  const map = { tokens: {} };
  injectControlGroup(map, group);
  assert.equal(map[MODULE_ID], group);
});

test("sceneControlEnabled: defaults true; respects setting", () => {
  assert.equal(sceneControlEnabled(null), true);
  assert.equal(sceneControlEnabled({}), true);
  assert.equal(sceneControlEnabled({ dataManager: {} }), true);
  assert.equal(
    sceneControlEnabled({ dataManager: { get: (key) => (key === SETTING_KEYS.ENABLE_SCENE_CONTROL ? false : true) } }),
    false
  );
  assert.equal(
    sceneControlEnabled({ dataManager: { get: () => true } }),
    true
  );
});

test("registerSceneControlHook: injects control when enabled", () => {
  const hooks = [];
  const env = {
    Hooks: { on: (name, fn) => hooks.push({ name, fn }) },
    game: { i18n: { has: () => false } }
  };
  const openCalls = [];
  const triggerz = {
    dataManager: { get: () => true },
    uiManager: { openGMHub: () => openCalls.push(1) }
  };
  registerSceneControlHook(env, () => triggerz);
  assert.equal(hooks[0].name, "getSceneControlButtons");
  const controls = [];
  hooks[0].fn(controls);
  assert.equal(controls.length, 1);
  assert.equal(controls[0].name, MODULE_ID);
  controls[0].tools[0].onChange(true);
  assert.equal(openCalls.length, 1);
});

test("registerSceneControlHook: no-ops when triggerz missing or disabled", () => {
  const hooks = [];
  const env = { Hooks: { on: (name, fn) => hooks.push({ name, fn }) } };
  registerSceneControlHook(env, () => null);
  const controls = [];
  assert.equal(hooks[0].fn(controls), controls);
  assert.equal(controls.length, 0);

  registerSceneControlHook(env, () => ({ dataManager: { get: () => false } }));
  const controls2 = [];
  assert.equal(hooks[1].fn(controls2), controls2);
  assert.equal(controls2.length, 0);
});
