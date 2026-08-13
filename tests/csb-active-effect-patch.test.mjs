import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyNumericCSBPropChange,
  installCSBNumericPropEffectSupport,
  isCSBSystemPropKey,
  patchCSBNumericPropEffectApply,
  registerCSBNumericPropEffectHook,
  toFiniteNumber
} from '../src/CSBActiveEffectPatch.js';

test('isCSBSystemPropKey: only system.props keys qualify', () => {
  assert.equal(isCSBSystemPropKey('system.props.DEF'), true);
  assert.equal(isCSBSystemPropKey('props.DEF'), false);
  assert.equal(isCSBSystemPropKey('system.hp.value'), false);
  assert.equal(isCSBSystemPropKey(null), false);
});

test('toFiniteNumber: coerces numeric strings and rejects junk', () => {
  assert.equal(toFiniteNumber(12), 12);
  assert.equal(toFiniteNumber('12'), 12);
  assert.equal(toFiniteNumber('  -0.1 '), -0.1);
  assert.equal(Number.isNaN(toFiniteNumber('ERROR')), true);
  assert.equal(Number.isNaN(toFiniteNumber('')), true);
  assert.equal(Number.isNaN(toFiniteNumber(undefined)), true);
  assert.equal(Number.isNaN(toFiniteNumber(Number.NaN)), true);
});

test('applyNumericCSBPropChange: ADD uses numeric math on string props', () => {
  const changes = { 'system.props.DEF': '1212' };
  const ok = applyNumericCSBPropChange(
    {},
    { key: 'system.props.DEF', mode: 2, value: '8' },
    '12',
    8,
    changes
  );
  assert.equal(ok, true);
  assert.equal(changes['system.props.DEF'], 20);
});

test('applyNumericCSBPropChange: MULTIPLY uses numeric math on string props', () => {
  const changes = {};
  const ok = applyNumericCSBPropChange(
    {},
    { key: 'system.props.DEF', mode: 1, value: '1.5' },
    '10',
    1.5,
    changes
  );
  assert.equal(ok, true);
  assert.equal(changes['system.props.DEF'], 15);
});

test('applyNumericCSBPropChange: falls back to change.value when delta is unusable', () => {
  const changes = {};
  const ok = applyNumericCSBPropChange(
    {},
    { key: 'system.props.ETO_check', mode: 2, value: '-0.1' },
    '1',
    undefined,
    changes
  );
  assert.equal(ok, true);
  assert.equal(changes['system.props.ETO_check'], 0.9);
});

test('applyNumericCSBPropChange: ignores non-props keys and non-add/multiply modes', () => {
  const changes = {};
  assert.equal(applyNumericCSBPropChange({}, { key: 'system.hp.value', mode: 2, value: '1' }, 5, 1, changes), false);
  assert.equal(applyNumericCSBPropChange({}, { key: 'system.props.DEF', mode: 5, value: '1' }, 5, 1, changes), false);
  assert.equal(applyNumericCSBPropChange({}, { key: 'system.props.DEF', mode: 2, value: 'x' }, 'nope', 'x', changes), false);
  assert.equal(applyNumericCSBPropChange({}, null, 1, 1, changes), false);
  assert.equal(Object.keys(changes).length, 0);
});

test('patchCSBNumericPropEffectApply: wraps Foundry ADD/MULTIPLY apply helpers', () => {
  const calls = [];
  const effectClass = {
    _applyChangeAdd(targetDoc, change, current, delta, changes) {
      calls.push('add');
      changes[change.key] = String(current) + String(delta);
    },
    _applyChangeMultiply(targetDoc, change, current, delta, changes) {
      calls.push('mul');
      changes[change.key] = String(current) + '*' + String(delta);
    }
  };
  const env = { CONFIG: { ActiveEffect: { documentClass: effectClass } } };

  assert.equal(patchCSBNumericPropEffectApply(env), true);
  assert.equal(patchCSBNumericPropEffectApply(env), true);

  const addChanges = {};
  effectClass._applyChangeAdd({}, { key: 'system.props.DEF', value: '8' }, '12', 8, addChanges);
  assert.equal(addChanges['system.props.DEF'], 20);
  assert.deepEqual(calls, []);

  const mulChanges = {};
  effectClass._applyChangeMultiply({}, { key: 'system.props.DEF', value: '2' }, '10', 2, mulChanges);
  assert.equal(mulChanges['system.props.DEF'], 20);
  assert.deepEqual(calls, []);

  const fallback = {};
  effectClass._applyChangeAdd({}, { key: 'system.hp.value', value: '1' }, '5', 1, fallback);
  assert.equal(fallback['system.hp.value'], '51');
  assert.deepEqual(calls, ['add']);
});

test('patchCSBNumericPropEffectApply: returns false without ActiveEffect class', () => {
  assert.equal(patchCSBNumericPropEffectApply({}), false);
  assert.equal(patchCSBNumericPropEffectApply({ CONFIG: {} }), false);
  assert.equal(patchCSBNumericPropEffectApply({ CONFIG: { ActiveEffect: {} } }), false);
  assert.equal(patchCSBNumericPropEffectApply({ CONFIG: { ActiveEffect: { documentClass: {} } } }), false);
});

test('patchCSBNumericPropEffectApply: patches ADD when MULTIPLY helper is missing', () => {
  const effectClass = {
    _applyChangeAdd(targetDoc, change, current, delta, changes) {
      changes[change.key] = 'fallback';
    }
  };
  const env = { CONFIG: { ActiveEffect: { documentClass: effectClass } } };
  assert.equal(patchCSBNumericPropEffectApply(env), true);
  const changes = {};
  effectClass._applyChangeAdd({}, { key: 'system.props.DEF', value: '3' }, '7', 3, changes);
  assert.equal(changes['system.props.DEF'], 10);
});

test('registerCSBNumericPropEffectHook: wires once', () => {
  const handlers = [];
  const env = {
    Hooks: {
      on(name, fn) {
        handlers.push({ name, fn });
      }
    }
  };

  assert.equal(registerCSBNumericPropEffectHook(env), true);
  assert.equal(registerCSBNumericPropEffectHook(env), true);
  assert.equal(handlers.length, 1);
  assert.equal(handlers[0].name, 'applyActiveEffect');

  const changes = { 'system.props.DEF': 'ERROR12' };
  handlers[0].fn({}, { key: 'system.props.DEF', mode: 2, value: '8' }, '12', 8, changes);
  assert.equal(changes['system.props.DEF'], 20);
});

test('registerCSBNumericPropEffectHook: returns false without Hooks.on', () => {
  assert.equal(registerCSBNumericPropEffectHook({}), false);
  assert.equal(registerCSBNumericPropEffectHook({ Hooks: {} }), false);
});

test('installCSBNumericPropEffectSupport: still succeeds via hook when ActiveEffect class is missing', () => {
  const handlers = [];
  const env = {
    CONFIG: {},
    Hooks: {
      on(name) {
        handlers.push(name);
      }
    }
  };
  assert.equal(installCSBNumericPropEffectSupport(env), true);
  assert.deepEqual(handlers, ['applyActiveEffect']);
});

test('installCSBNumericPropEffectSupport: returns false when neither patch nor hook can install', () => {
  assert.equal(installCSBNumericPropEffectSupport({}), false);
});

test('installCSBNumericPropEffectSupport: installs patch and hook', () => {
  const handlers = [];
  const effectClass = {
    _applyChangeAdd() {},
    _applyChangeMultiply() {}
  };
  const env = {
    CONFIG: { ActiveEffect: { documentClass: effectClass } },
    Hooks: {
      on(name) {
        handlers.push(name);
      }
    }
  };
  assert.equal(installCSBNumericPropEffectSupport(env), true);
  assert.equal(effectClass._applyChangeAdd.__ldTriggerzPatched, true);
  assert.deepEqual(handlers, ['applyActiveEffect']);
});
