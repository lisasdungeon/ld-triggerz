import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyNumericCSBPropChange,
  installCSBNumericPropEffectSupport,
  isCSBFormulaText,
  isCSBSystemPropKey,
  patchCSBNumericPropEffectApply,
  patchComputablePhrasePreserveActiveEffectFormulas,
  registerCSBNumericPropEffectHook,
  resolveEffectDeltaAmount,
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

test('isCSBFormulaText: only recognizes ${ ... }$ wrapped text', () => {
  assert.equal(isCSBFormulaText('${ ATK_calc * 0.08 }$'), true);
  assert.equal(isCSBFormulaText('ATK_calc * 0.08'), false);
  assert.equal(isCSBFormulaText('8'), false);
  assert.equal(isCSBFormulaText(null), false);
});

test('resolveEffectDeltaAmount: NaN when change itself is missing', () => {
  assert.equal(Number.isNaN(resolveEffectDeltaAmount({}, null, undefined, {})), true);
  assert.equal(Number.isNaN(resolveEffectDeltaAmount({}, undefined, undefined, {})), true);
});

test('resolveEffectDeltaAmount: prefers a numeric delta over everything else', () => {
  assert.equal(resolveEffectDeltaAmount({}, { value: '${ ATK_calc }$' }, 5), 5);
});

test('resolveEffectDeltaAmount: falls back to a numeric change.value when delta is unusable', () => {
  assert.equal(resolveEffectDeltaAmount({}, { value: '8' }, undefined), 8);
});

test('resolveEffectDeltaAmount: evaluates a CSB formula against the target props', () => {
  const calls = [];
  const targetDoc = { system: { props: { ATK_calc: 100 } }, templateSystem: 'kirito-template' };
  const env = {
    ComputablePhrase: {
      computeMessageStatic(formula, props, options) {
        calls.push({ formula, props, options });
        return { result: props.ATK_calc * 0.08 };
      }
    }
  };
  const amount = resolveEffectDeltaAmount(targetDoc, { value: '${ ATK_calc * 0.08 }$' }, undefined, env);
  assert.equal(amount, 8);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].formula, '${ ATK_calc * 0.08 }$');
  assert.equal(calls[0].props.ATK_calc, 100);
  assert.equal(calls[0].options.source, 'ld-triggerz.activeEffect.delta');
  assert.equal(calls[0].options.triggerEntity, 'kirito-template');
});

test('resolveEffectDeltaAmount: NaN for non-numeric, non-formula text', () => {
  assert.equal(Number.isNaN(resolveEffectDeltaAmount({}, { value: 'nope' }, undefined, {})), true);
});

test('resolveEffectDeltaAmount: NaN when a formula is present but ComputablePhrase is unavailable', () => {
  assert.equal(Number.isNaN(resolveEffectDeltaAmount({}, { value: '${ ATK_calc }$' }, undefined, {})), true);
});

test('resolveEffectDeltaAmount: NaN when the formula throws (e.g. UncomputableError)', () => {
  const env = {
    ComputablePhrase: {
      computeMessageStatic() {
        throw new Error('Uncomputable token "ATK_calc"');
      }
    }
  };
  assert.equal(Number.isNaN(resolveEffectDeltaAmount({}, { value: '${ ATK_calc }$' }, undefined, env)), true);
});

test('applyNumericCSBPropChange: a finite current with an unresolvable non-formula amount is skipped, not logged', () => {
  const changes = {};
  const ok = applyNumericCSBPropChange(
    {},
    { key: 'system.props.DEF', mode: 2, value: 'garbage' },
    '5',
    undefined,
    changes
  );
  assert.equal(ok, false);
  assert.equal(Object.keys(changes).length, 0);
});

test('applyNumericCSBPropChange: resolves a formula delta through the env ComputablePhrase', () => {
  const changes = {};
  const targetDoc = { system: { props: { ATK_calc: 100, DEF: 10 } } };
  const env = {
    ComputablePhrase: {
      computeMessageStatic(formula, props) {
        return { result: props.ATK_calc * 0.08 };
      }
    }
  };
  const ok = applyNumericCSBPropChange(
    targetDoc,
    { key: 'system.props.DEF', mode: 2, value: '${ ATK_calc * 0.08 }$' },
    '10',
    undefined,
    changes,
    env
  );
  assert.equal(ok, true);
  assert.equal(changes['system.props.DEF'], 18);
});

test('applyNumericCSBPropChange: an unresolvable formula is logged and skipped, never thrown', () => {
  const consoleCalls = [];
  const notifications = [];
  const changes = {};
  const targetDoc = { system: { props: {} } };
  const env = {
    console: { error: (...args) => consoleCalls.push(args) },
    ui: { notifications: { error: (message) => notifications.push(message) } },
    ComputablePhrase: {
      computeMessageStatic() {
        throw new Error('Uncomputable token "ATK_calc"');
      }
    }
  };
  assert.doesNotThrow(() => {
    const ok = applyNumericCSBPropChange(
      targetDoc,
      { key: 'system.props.ATK_calc', mode: 2, value: '${ ATK_calc * 0.08 }$' },
      '10',
      undefined,
      changes,
      env
    );
    assert.equal(ok, false);
  });
  assert.equal(Object.keys(changes).length, 0);
  assert.equal(consoleCalls.length, 1);
  assert.match(consoleCalls[0][0], /Uncomputable active effect delta for system\.props\.ATK_calc/);
  assert.equal(notifications.length, 1);
});

test('patchComputablePhrasePreserveActiveEffectFormulas: no-op without ComputablePhrase', () => {
  assert.equal(patchComputablePhrasePreserveActiveEffectFormulas({}), false);
  assert.equal(patchComputablePhrasePreserveActiveEffectFormulas({ ComputablePhrase: {} }), false);
});

test('patchComputablePhrasePreserveActiveEffectFormulas: patches once and passes through successful computations', () => {
  const calls = [];
  const env = {
    ComputablePhrase: {
      computeMessageStatic(phrase, props, options) {
        calls.push(phrase);
        return { result: 'fine' };
      }
    }
  };
  assert.equal(patchComputablePhrasePreserveActiveEffectFormulas(env), true);
  assert.equal(patchComputablePhrasePreserveActiveEffectFormulas(env), true);
  assert.equal(env.ComputablePhrase.computeMessageStatic('hello', {}, {}).result, 'fine');
  assert.deepEqual(calls, ['hello']);
});

test('patchComputablePhrasePreserveActiveEffectFormulas: preserves formula text when an active effect value is uncomputable', () => {
  const env = {
    ComputablePhrase: {
      computeMessageStatic() {
        throw new Error('Uncomputable token "ATK_calc"');
      }
    }
  };
  patchComputablePhrasePreserveActiveEffectFormulas(env);
  const result = env.ComputablePhrase.computeMessageStatic('${ ATK_calc * 0.08 }$', {}, { source: 'activeEffect.Rempart.value' });
  assert.equal(result.result, '${ ATK_calc * 0.08 }$');
});

test('patchComputablePhrasePreserveActiveEffectFormulas: rethrows for a missing phrase', () => {
  const env = {
    ComputablePhrase: {
      computeMessageStatic() {
        throw new Error('boom');
      }
    }
  };
  patchComputablePhrasePreserveActiveEffectFormulas(env);
  assert.throws(() => env.ComputablePhrase.computeMessageStatic(undefined, {}, { source: 'activeEffect.Rempart.value' }), /boom/);
});

test('patchComputablePhrasePreserveActiveEffectFormulas: rethrows for non-matching sources or non-formula text', () => {
  const env = {
    ComputablePhrase: {
      computeMessageStatic() {
        throw new Error('boom');
      }
    }
  };
  patchComputablePhrasePreserveActiveEffectFormulas(env);
  assert.throws(() => env.ComputablePhrase.computeMessageStatic('${ ATK_calc }$', {}, { source: 'activeEffect.Rempart.key' }), /boom/);
  assert.throws(() => env.ComputablePhrase.computeMessageStatic('plain text', {}, { source: 'activeEffect.Rempart.value' }), /boom/);
  assert.throws(() => env.ComputablePhrase.computeMessageStatic('${ ATK_calc }$', {}, {}), /boom/);
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
