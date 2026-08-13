// Exercises the module's Foundry hook wiring, including the fix for the
// previously-unhandled processActorUpdate/processTokenUpdate rejections and
// the readyHook() null guard for out-of-order hook firing.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activeEffectCreateHook,
  actorUpdateHook,
  getActiveInstance,
  initHook,
  readyHook,
  registerHooks,
  resetHooksForTests,
  tokenUpdateHook
} from '../src/hooks.js';

class ApplicationV2 {}
function HandlebarsApplicationMixin(Base) {
  return class extends Base {};
}

function makeEnv() {
  const settingsStore = {};
  const menuKeys = [];
  const hooksOnce = [];
  const hooksOn = [];
  const socketHandlers = [];
  const consoleErrors = [];
  const notifications = [];

  return {
    consoleErrors,
    notifications,
    hooksOnce,
    hooksOn,
    game: {
      userId: 'gm-user',
      settings: {
        settings: { has: (fullKey) => Object.prototype.hasOwnProperty.call(settingsStore, fullKey) },
        menus: { has: (fullKey) => menuKeys.includes(fullKey) },
        register: (moduleId, key, definition) => { settingsStore[`${moduleId}.${key}`] = definition.default; },
        registerMenu: (moduleId, key) => menuKeys.push(`${moduleId}.${key}`),
        get: (moduleId, key) => settingsStore[`${moduleId}.${key}`],
        set: (moduleId, key, value) => { settingsStore[`${moduleId}.${key}`] = value; }
      },
      socket: { on: (channel, fn) => socketHandlers.push({ channel, fn }) },
      macros: { get: () => undefined }
    },
    CONFIG: { statusEffects: [] },
    foundry: { applications: { api: { ApplicationV2, HandlebarsApplicationMixin } } },
    Hooks: {
      once: (name, fn) => hooksOnce.push({ name, fn }),
      on: (name, fn) => hooksOn.push({ name, fn })
    },
    console: { error: (...args) => consoleErrors.push(args), debug: () => {}, log: () => {} },
    ui: { notifications: { error: (message) => notifications.push(message) } }
  };
}

test('readyHook: returns false instead of throwing when no instance has been initialized', () => {
  resetHooksForTests();
  assert.equal(readyHook(), false);
});

test('initHook: constructs and returns the active instance; readyHook then delegates to it', () => {
  resetHooksForTests();
  const env = makeEnv();
  const instance = initHook(env);
  assert.equal(getActiveInstance(), instance);
  assert.equal(readyHook(), instance);
});

test('registerHooks: wires init/ready once, updateActor/updateToken/createActiveEffect/getSceneControlButtons on', () => {
  resetHooksForTests();
  const env = makeEnv();
  assert.equal(registerHooks(env), true);
  assert.deepEqual(env.hooksOnce.map((h) => h.name), ['init', 'ready']);
  const onNames = env.hooksOn.map((h) => h.name);
  assert.ok(onNames.includes('updateActor'));
  assert.ok(onNames.includes('updateToken'));
  assert.ok(onNames.includes('createActiveEffect'));
  assert.ok(onNames.includes('getSceneControlButtons'));
});

test('registerHooks: returns false when env.Hooks is unavailable', () => {
  assert.equal(registerHooks({}), false);
});

test('actorUpdateHook: ignores updates from a different client (userId mismatch)', () => {
  resetHooksForTests();
  const env = makeEnv();
  initHook(env);
  assert.equal(actorUpdateHook({ id: 'a1' }, {}, {}, 'someone-else', env), false);
});

test('actorUpdateHook: a rejected processActorUpdate is caught and logged, not thrown', async () => {
  resetHooksForTests();
  const env = makeEnv();
  const instance = initHook(env);
  instance.processActorUpdate = () => Promise.reject(new Error('boom'));

  assert.equal(actorUpdateHook({ id: 'a1', name: 'Goblin' }, {}, {}, env.game.userId, env), true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(env.consoleErrors.length, 1);
  assert.match(env.consoleErrors[0][0], /boom/);
});

test('actorUpdateHook: an error with no message falls back to a descriptive one naming the actor', async () => {
  resetHooksForTests();
  const env = makeEnv();
  const instance = initHook(env);
  instance.processActorUpdate = () => Promise.reject(new Error(''));

  actorUpdateHook({ id: 'a1', name: 'Goblin' }, {}, {}, env.game.userId, env);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.match(env.consoleErrors[0][0], /Goblin/);
});

test('tokenUpdateHook: ignores updates from a different client (userId mismatch)', () => {
  resetHooksForTests();
  const env = makeEnv();
  initHook(env);
  assert.equal(tokenUpdateHook({ id: 't1' }, {}, {}, 'someone-else', env), false);
});

test('tokenUpdateHook: a rejected processTokenUpdate is caught and logged, not thrown', async () => {
  resetHooksForTests();
  const env = makeEnv();
  const instance = initHook(env);
  instance.processTokenUpdate = () => Promise.reject(new Error('boom'));

  assert.equal(tokenUpdateHook({ id: 't1', name: 'Goblin Token' }, {}, {}, env.game.userId, env), true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(env.consoleErrors.length, 1);
  assert.match(env.consoleErrors[0][0], /boom/);
});

test('activeEffectCreateHook: ignores foreign users and missing instance', () => {
  resetHooksForTests();
  const env = makeEnv();
  assert.equal(activeEffectCreateHook({ id: 'e1' }, {}, env.game.userId, env), false);
  initHook(env);
  assert.equal(activeEffectCreateHook({ id: 'e1' }, {}, 'someone-else', env), false);
});

test('activeEffectCreateHook: a rejected sync is caught and logged', async () => {
  resetHooksForTests();
  const env = makeEnv();
  const instance = initHook(env);
  instance.processActiveEffectCreate = () => Promise.reject(new Error('sync-fail'));
  assert.equal(activeEffectCreateHook({ id: 'e1', name: 'Étourdis' }, {}, env.game.userId, env), true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(env.consoleErrors.length, 1);
  assert.match(env.consoleErrors[0][0], /sync-fail/);
});

test('activeEffectCreateHook: empty error falls back using effect id when name is missing', async () => {
  resetHooksForTests();
  const env = makeEnv();
  const instance = initHook(env);
  instance.processActiveEffectCreate = () => Promise.reject(new Error(''));
  assert.equal(activeEffectCreateHook({ id: 'eff-42' }, {}, env.game.userId, env), true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.match(env.consoleErrors[0][0], /eff-42/);
});
