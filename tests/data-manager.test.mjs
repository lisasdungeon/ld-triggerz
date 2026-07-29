import assert from 'node:assert/strict';
import test from 'node:test';
import { DataManager, SETTING_DEFINITIONS } from '../src/DataManager.js';
import { SETTING_KEYS } from '../src/constants.js';

function makeGame() {
  const store = {};
  const registered = [];
  const menus = [];
  return {
    store,
    registered,
    menus,
    settings: {
      settings: { has: (fullKey) => Object.prototype.hasOwnProperty.call(store, fullKey) },
      menus: { has: (fullKey) => menus.includes(fullKey) },
      register: (moduleId, key, definition) => {
        registered.push({ moduleId, key, definition });
        store[`${moduleId}.${key}`] = definition.default;
      },
      registerMenu: (moduleId, key) => menus.push(`${moduleId}.${key}`),
      get: (moduleId, key) => store[`${moduleId}.${key}`],
      set: (moduleId, key, value) => { store[`${moduleId}.${key}`] = value; return value; }
    }
  };
}

test('registerSettings: registers every entry in SETTING_DEFINITIONS exactly once', () => {
  const game = makeGame();
  const dm = new DataManager({ game });
  assert.equal(dm.registerSettings(), SETTING_DEFINITIONS.length);
  assert.equal(game.registered.length, SETTING_DEFINITIONS.length);
});

test('registerSettings: is idempotent — a second call skips already-registered keys', () => {
  const game = makeGame();
  const dm = new DataManager({ game });
  dm.registerSettings();
  dm.registerSettings();
  assert.equal(game.registered.length, SETTING_DEFINITIONS.length);
});

test('requireSettings: throws when game.settings is unavailable', () => {
  const dm = new DataManager({ game: {} });
  assert.throws(() => dm.requireSettings(), /requires Foundry game.settings/);
});

test('registerMenu: registers once, returns false on a second call for the same key', () => {
  const game = makeGame();
  const dm = new DataManager({ game });
  assert.equal(dm.registerMenu('gmHub', { name: 'x' }), true);
  assert.equal(dm.registerMenu('gmHub', { name: 'x' }), false);
});

test('triggers: getTriggers defaults to [], upsertTrigger replaces by id, deleteTrigger removes by id', async () => {
  const game = makeGame();
  const dm = new DataManager({ game });
  dm.registerSettings();
  assert.deepEqual(dm.getTriggers(), []);

  await dm.upsertTrigger({ id: 't1', name: 'First' });
  await dm.upsertTrigger({ id: 't2', name: 'Second' });
  await dm.upsertTrigger({ id: 't1', name: 'First (updated)' });
  const triggers = dm.getTriggers();
  assert.equal(triggers.length, 2);
  assert.equal(triggers.find((t) => t.id === 't1').name, 'First (updated)');

  await dm.deleteTrigger('t1');
  assert.deepEqual(dm.getTriggers().map((t) => t.id), ['t2']);
});

test('upsertTrigger: throws without an id', async () => {
  const dm = new DataManager({ game: makeGame() });
  await assert.rejects(() => dm.upsertTrigger({}), /requires an id/);
});

test('conditions: getConditions defaults to [], upsertCondition replaces by id, deleteCondition removes by id', async () => {
  const game = makeGame();
  const dm = new DataManager({ game });
  dm.registerSettings();
  await dm.upsertCondition({ id: 'c1', name: 'Bloodied' });
  assert.equal(dm.getConditions().length, 1);
  await dm.deleteCondition('c1');
  assert.deepEqual(dm.getConditions(), []);
});

test('upsertCondition: throws without an id', async () => {
  const dm = new DataManager({ game: makeGame() });
  await assert.rejects(() => dm.upsertCondition({}), /requires an id/);
});

test('exportData / importData: round-trips triggers and conditions', async () => {
  const game = makeGame();
  const dm = new DataManager({ game, moduleId: 'ld-triggerz' });
  dm.registerSettings();
  await dm.importData({ triggers: [{ id: 't1' }], conditions: [{ id: 'c1' }] });
  const exported = dm.exportData();
  assert.equal(exported.moduleId, 'ld-triggerz');
  assert.deepEqual(exported.triggers, [{ id: 't1' }]);
  assert.deepEqual(exported.conditions, [{ id: 'c1' }]);
});

test('importData: missing triggers/conditions in the payload clears to []', async () => {
  const game = makeGame();
  const dm = new DataManager({ game });
  dm.registerSettings();
  await dm.upsertTrigger({ id: 't1' });
  await dm.importData({});
  assert.deepEqual(dm.getTriggers(), []);
  assert.deepEqual(dm.getConditions(), []);
});

test('SETTING_DEFINITIONS: includes the Debug Logging config setting', () => {
  const debugDef = SETTING_DEFINITIONS.find((def) => def.key === SETTING_KEYS.DEBUG);
  assert.ok(debugDef);
  assert.equal(debugDef.type, Boolean);
  assert.equal(debugDef.config, true);
});
