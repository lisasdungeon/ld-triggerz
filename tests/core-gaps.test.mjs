import assert from "node:assert/strict";
import test from "node:test";
import { DataManager } from "../src/DataManager.js";
import {
  actorUpdateHook,
  initHook,
  readyHook,
  registerHooks,
  resetHooksForTests,
  tokenUpdateHook
} from "../src/hooks.js";
import { debugLog, errorLog, isDebugEnabled } from "../src/Logger.js";
import { createMacroRunner, macroScope } from "../src/MacroRunner.js";
import {
  coerceValue,
  evaluateTrigger,
  isNumericValue,
  resolveTriggerRightValue,
  TriggerEngine
} from "../src/TriggerEngine.js";
import { cloneData, localize } from "../src/utils.js";
import { OPERATORS } from "../src/constants.js";

function makeGame() {
  const store = {};
  const menus = [];
  return {
    settings: {
      settings: { has: (fullKey) => Object.prototype.hasOwnProperty.call(store, fullKey) },
      menus: { has: (fullKey) => menus.includes(fullKey) },
      register: (moduleId, key, definition) => {
        store[`${moduleId}.${key}`] = definition.default;
      },
      registerMenu: (moduleId, key) => menus.push(`${moduleId}.${key}`),
      get: (moduleId, key) => store[`${moduleId}.${key}`],
      set: (moduleId, key, value) => {
        store[`${moduleId}.${key}`] = value;
        return value;
      }
    }
  };
}

test("DataManager.registerMenu: returns false when registerMenu is missing", () => {
  const game = makeGame();
  delete game.settings.registerMenu;
  const dm = new DataManager({ game });
  assert.equal(dm.registerMenu("gmHub", { name: "x" }), false);
});

test("DataManager.saveTriggers/saveConditions: non-array payloads become empty arrays", async () => {
  const game = makeGame();
  const dm = new DataManager({ game });
  dm.registerSettings();
  await dm.saveTriggers(null);
  await dm.saveConditions("nope");
  assert.deepEqual(dm.getTriggers(), []);
  assert.deepEqual(dm.getConditions(), []);
});

test("DataManager.getTriggers/getConditions: null stored values become []", async () => {
  const game = makeGame();
  const dm = new DataManager({ game });
  dm.registerSettings();
  await dm.set("triggers", null);
  await dm.set("conditions", null);
  assert.deepEqual(dm.getTriggers(), []);
  assert.deepEqual(dm.getConditions(), []);
});

test("cloneData: uses structuredClone when foundry deepClone is absent", () => {
  const env = {
    structuredClone: (value) => ({ ...value, via: "structured" })
  };
  assert.deepEqual(cloneData({ a: 1 }, env), { a: 1, via: "structured" });
});

test("localize: default fallback is the key itself", () => {
  assert.equal(localize("SOME.KEY", undefined, {}), "SOME.KEY");
});

test("debugLog: returns false when console has no write function", () => {
  const env = {
    game: { settings: { get: () => true } },
    console: {}
  };
  assert.equal(debugLog(env, "hello"), false);
});

test("debugLog: uses global console when env.console is missing", () => {
  const original = console.debug;
  const calls = [];
  console.debug = (...args) => calls.push(args);
  try {
    const env = { game: { settings: { get: () => true } } };
    assert.equal(debugLog(env, "hello-global"), true);
    assert.ok(calls.some((c) => String(c[0]).includes("hello-global")));
  } finally {
    console.debug = original;
  }
});

test("errorLog: still returns false when console.error is missing", () => {
  assert.equal(errorLog({ console: {} }, "msg", new Error("x")), false);
});

test("isDebugEnabled: defaults env to globalThis", () => {
  assert.equal(typeof isDebugEnabled(), "boolean");
});

test("macroScope: empty object target still yields actor when self-referential shape", () => {
  assert.deepEqual(macroScope({}), { actor: {} });
});

test("createMacroRunner: uses default env globalThis when none supplied", async () => {
  const runner = createMacroRunner();
  const result = await runner("", {});
  assert.equal(result, false);
});

test("isNumericValue: rejects empty, null, undefined, and non-numeric text", () => {
  assert.equal(isNumericValue(""), false);
  assert.equal(isNumericValue(null), false);
  assert.equal(isNumericValue(undefined), false);
  assert.equal(isNumericValue("abc"), false);
  assert.equal(isNumericValue("12"), true);
});

test("coerceValue: boolean false string becomes false", () => {
  assert.equal(coerceValue("false", true), false);
  assert.equal(coerceValue(true, true), true);
});

test("resolveTriggerRightValue: reads a path from the update payload", () => {
  const trigger = { value: "hp.max" };
  assert.equal(resolveTriggerRightValue(trigger, {}, 0, { "hp.max": 30 }), 30);
});

test("evaluateTrigger: npcOnly allows non-player actors", () => {
  const trigger = { id: "t1", path: "hp.value", operator: OPERATORS.EQ, value: 0, npcOnly: true };
  assert.equal(evaluateTrigger(trigger, { hasPlayerOwner: false }, { "hp.value": 0 }), true);
});

test("TriggerEngine.resolveAction: leaves actions without condition untouched", () => {
  const engine = new TriggerEngine({ adapter: { runAction: async () => {} } });
  const action = { type: "runMacro", macroId: "m1" };
  assert.equal(engine.resolveAction(action), action);
});

test("TriggerEngine.resolveAction: falls back when resolver returns null", () => {
  const engine = new TriggerEngine({
    adapter: { runAction: async () => {} },
    conditionResolver: () => null
  });
  const action = { type: "applyCondition", condition: { id: "c1" } };
  assert.deepEqual(engine.resolveAction(action).condition, { id: "c1" });
});

test("registerHooks: registered callbacks invoke init/ready/actor/token handlers", async () => {
  resetHooksForTests();
  const hooksOnce = [];
  const hooksOn = [];
  const settingsStore = {};
  const menuKeys = [];
  const env = {
    game: {
      userId: "gm-user",
      settings: {
        settings: { has: (k) => Object.prototype.hasOwnProperty.call(settingsStore, k) },
        menus: { has: (k) => menuKeys.includes(k) },
        register: (moduleId, key, definition) => {
          settingsStore[`${moduleId}.${key}`] = definition.default;
        },
        registerMenu: (moduleId, key) => menuKeys.push(`${moduleId}.${key}`),
        get: (moduleId, key) => settingsStore[`${moduleId}.${key}`],
        set: (moduleId, key, value) => {
          settingsStore[`${moduleId}.${key}`] = value;
        }
      },
      socket: { on: () => {} },
      macros: { get: () => undefined }
    },
    CONFIG: { statusEffects: [] },
    foundry: {
      applications: {
        api: {
          ApplicationV2: class {},
          HandlebarsApplicationMixin: (Base) => class extends Base {}
        }
      }
    },
    Hooks: {
      once: (name, fn) => hooksOnce.push({ name, fn }),
      on: (name, fn) => hooksOn.push({ name, fn })
    },
    console: { error: () => {}, debug: () => {}, log: () => {} },
    ui: { notifications: { error: () => {} } }
  };

  assert.equal(registerHooks(env), true);
  const init = hooksOnce.find((h) => h.name === "init");
  const ready = hooksOnce.find((h) => h.name === "ready");
  init.fn();
  assert.ok(readyHook());
  ready.fn();

  const instance = initHook(env);
  instance.processActorUpdate = async () => true;
  instance.processTokenUpdate = async () => true;
  instance.processActiveEffectCreate = async () => true;

  const actorHook = hooksOn.find((h) => h.name === "updateActor");
  const tokenHook = hooksOn.find((h) => h.name === "updateToken");
  const effectHook = hooksOn.find((h) => h.name === "createActiveEffect");
  assert.equal(actorHook.fn({ id: "a1" }, {}, {}, env.game.userId), true);
  assert.equal(tokenHook.fn({ id: "t1" }, {}, {}, env.game.userId), true);
  assert.equal(effectHook.fn({ id: "e1" }, {}, env.game.userId), true);
  await new Promise((r) => setTimeout(r, 0));
});

test("actorUpdateHook/tokenUpdateHook: default env path uses globalThis", () => {
  resetHooksForTests();
  const settingsStore = {};
  const menuKeys = [];
  globalThis.game = {
    userId: "u1",
    settings: {
      settings: { has: () => false },
      menus: { has: () => false },
      register: (moduleId, key, definition) => {
        settingsStore[`${moduleId}.${key}`] = definition.default;
      },
      registerMenu: (moduleId, key) => menuKeys.push(`${moduleId}.${key}`),
      get: (moduleId, key) => settingsStore[`${moduleId}.${key}`],
      set: () => {}
    },
    socket: { on: () => {} },
    macros: { get: () => undefined }
  };
  globalThis.CONFIG = { statusEffects: [] };
  globalThis.foundry = {
    applications: {
      api: {
        ApplicationV2: class {},
        HandlebarsApplicationMixin: (Base) => class extends Base {}
      }
    }
  };
  globalThis.ui = { notifications: { error: () => {} } };
  try {
    const instance = initHook();
    instance.processActorUpdate = async () => true;
    instance.processTokenUpdate = async () => true;
    assert.equal(actorUpdateHook({ id: "a" }, {}, {}, "u1"), true);
    assert.equal(tokenUpdateHook({ id: "t" }, {}, {}, "u1"), true);
  } finally {
    resetHooksForTests();
    delete globalThis.game;
    delete globalThis.CONFIG;
    delete globalThis.foundry;
    delete globalThis.ui;
  }
});
