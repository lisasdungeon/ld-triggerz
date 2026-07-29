// Covers the fix for the previously-orphaned "Run macro" trigger action:
// createMacroRunner() is what TriggerEngine now calls for ACTION_TYPES.RUN_MACRO.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createMacroRunner, macroScope, resolveMacro } from '../src/MacroRunner.js';

function makeEnv({ macro, notifications = [], errors = [] } = {}) {
  return {
    game: { macros: { get: (id) => (id === macro?.id ? macro : undefined) } },
    console: { error: (...args) => errors.push(args), debug: () => {} },
    ui: { notifications: { error: (message) => notifications.push(message) } }
  };
}

test('macroScope: a token-shaped target contributes both token and actor', () => {
  const actor = { id: 'actor1' };
  const token = { actor };
  assert.deepEqual(macroScope(token), { actor, token });
});

test('macroScope: a bare actor contributes only actor', () => {
  const actor = { id: 'actor1' };
  assert.deepEqual(macroScope(actor), { actor });
});

test('macroScope: a nullish or non-object target yields an empty scope', () => {
  assert.deepEqual(macroScope(null), {});
  assert.deepEqual(macroScope(undefined), {});
  assert.deepEqual(macroScope('not-an-object'), {});
});

test('resolveMacro: throws when the macro id is blank', () => {
  assert.throws(() => resolveMacro('', makeEnv()), /missing a macro id/);
  assert.throws(() => resolveMacro(null, makeEnv()), /missing a macro id/);
});

test('resolveMacro: throws when the macro collection is unavailable', () => {
  assert.throws(() => resolveMacro('abc', {}), /Foundry macro collection is unavailable/);
});

test('resolveMacro: throws when no macro matches the id', () => {
  assert.throws(() => resolveMacro('missing-id', makeEnv({ macro: { id: 'other' } })), /No macro found for id "missing-id"/);
});

test('resolveMacro: throws when the resolved document has no execute()', () => {
  assert.throws(() => resolveMacro('m1', makeEnv({ macro: { id: 'm1' } })), /cannot be executed/);
});

test('resolveMacro: returns the macro when it resolves and is executable', () => {
  const macro = { id: 'm1', execute: async () => {} };
  assert.equal(resolveMacro('m1', makeEnv({ macro })), macro);
});

test('createMacroRunner: resolves and executes the macro with the built scope', async () => {
  const calls = [];
  const macro = { id: 'm1', name: 'Test Macro', execute: async (scope) => { calls.push(scope); return 'ran'; } };
  const runner = createMacroRunner(makeEnv({ macro }));
  const actor = { id: 'actor1' };
  const result = await runner('m1', actor);
  assert.equal(result, 'ran');
  assert.deepEqual(calls, [{ actor }]);
});

test('createMacroRunner: an unresolvable macro id is reported, not thrown', async () => {
  const errors = [];
  const runner = createMacroRunner(makeEnv({ errors }));
  const result = await runner('missing-id', {});
  assert.equal(result, false);
  assert.equal(errors.length, 1);
  assert.match(errors[0][0], /No macro found for id "missing-id"/);
});

test('createMacroRunner: a macro that throws during execute() is reported, not thrown', async () => {
  const errors = [];
  const macro = { id: 'm1', name: 'Bad Macro', execute: async () => { throw new Error('macro exploded'); } };
  const runner = createMacroRunner(makeEnv({ macro, errors }));
  const result = await runner('m1', {});
  assert.equal(result, false);
  assert.equal(errors.length, 1);
  assert.match(errors[0][0], /Bad Macro" threw during execution/);
});
