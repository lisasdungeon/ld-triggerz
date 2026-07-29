import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTriggerLabel,
  coerceValue,
  compareValues,
  createDefaultTrigger,
  evaluateTrigger,
  linkedActionsForTrigger,
  normalizeTrigger,
  resolvePathValue,
  resolveTriggerRightValue,
  resolveUpdatePath,
  TriggerEngine
} from '../src/TriggerEngine.js';
import { ACTION_TYPES, OPERATORS } from '../src/constants.js';

test('compareValues: applies every operator correctly', () => {
  assert.equal(compareValues(OPERATORS.EQ, 5, 5), true);
  assert.equal(compareValues(OPERATORS.NE, 5, 6), true);
  assert.equal(compareValues(OPERATORS.LT, 5, 6), true);
  assert.equal(compareValues(OPERATORS.LTE, 5, 5), true);
  assert.equal(compareValues(OPERATORS.GT, 6, 5), true);
  assert.equal(compareValues(OPERATORS.GTE, 5, 5), true);
});

test('compareValues: numeric-looking strings compare numerically, not lexically', () => {
  assert.equal(compareValues(OPERATORS.LT, '9', '10'), true);
  assert.equal(compareValues(OPERATORS.LT, 9, '10'), true);
});

test('compareValues: non-numeric strings compare as strings', () => {
  assert.equal(compareValues(OPERATORS.EQ, 'stunned', 'stunned'), true);
  assert.equal(compareValues(OPERATORS.LT, 'apple', 'banana'), true);
});

test('coerceValue: coerces to match the exemplar\'s type', () => {
  assert.equal(coerceValue('5', 1), 5);
  assert.equal(coerceValue('true', true), true);
  assert.equal(coerceValue('false', true), false);
  assert.equal(coerceValue(5, 'x'), '5');
});

test('resolvePathValue: prefers the update payload over the entity when both have the path', () => {
  const entity = { hp: 10 };
  const update = { hp: 3 };
  assert.equal(resolvePathValue(entity, update, 'hp'), 3);
});

test('resolvePathValue: falls back to the entity when the update lacks the path', () => {
  const entity = { hp: 10 };
  assert.equal(resolvePathValue(entity, {}, 'hp'), 10);
});

test('resolveUpdatePath: returns the literal path when present in the update', () => {
  assert.equal(resolveUpdatePath({ 'system.hp.value': 3 }, 'system.hp.value'), 'system.hp.value');
});

test('resolveUpdatePath: strips a leading "system." and retries against the update', () => {
  assert.equal(resolveUpdatePath({ 'hp.value': 3 }, 'system.hp.value'), 'hp.value');
});

test('resolveUpdatePath: undefined when neither form is present in the update', () => {
  assert.equal(resolveUpdatePath({}, 'system.hp.value'), undefined);
});

test('resolveTriggerRightValue: a "%" suffix computes a percentage of comparePath on the entity', () => {
  const trigger = { value: '50%', comparePath: 'hp.max' };
  const entity = { hp: { max: 20 } };
  assert.equal(resolveTriggerRightValue(trigger, entity, 5, {}), 10);
});

test('resolveTriggerRightValue: a value matching another field name reads that field', () => {
  const trigger = { value: 'threshold' };
  const entity = { threshold: 7 };
  assert.equal(resolveTriggerRightValue(trigger, entity, 0, {}), 7);
});

test('resolveTriggerRightValue: a blank value with a comparePath reads the comparePath', () => {
  const trigger = { value: '', comparePath: 'hp.max' };
  const entity = { hp: { max: 20 } };
  assert.equal(resolveTriggerRightValue(trigger, entity, 0, {}), 20);
});

test('resolveTriggerRightValue: otherwise coerces the literal value against leftValue\'s type', () => {
  const trigger = { value: '3' };
  assert.equal(resolveTriggerRightValue(trigger, {}, 5, {}), 3);
});

test('buildTriggerLabel: renders "path operator value"', () => {
  assert.equal(buildTriggerLabel({ path: 'hp.value', operator: OPERATORS.LTE, value: 0 }), 'hp.value lte 0');
});

test('normalizeTrigger: requires an id and a path', () => {
  assert.throws(() => normalizeTrigger({ path: 'hp' }), /requires an id/);
  assert.throws(() => normalizeTrigger({ id: 't1' }), /requires a path/);
});

test('normalizeTrigger: rejects an unsupported operator', () => {
  assert.throws(() => normalizeTrigger({ id: 't1', path: 'hp', operator: 'nope' }), /Unsupported trigger operator/);
});

test('normalizeTrigger: defaults operator to EQ, actions to [], and derives a label', () => {
  const trigger = normalizeTrigger({ id: 't1', path: 'hp.value', value: 0 });
  assert.equal(trigger.operator, OPERATORS.EQ);
  assert.deepEqual(trigger.actions, []);
  assert.equal(trigger.label, 'hp.value eq 0');
});

test('evaluateTrigger: fires when the path in the update crosses the threshold', () => {
  const trigger = { id: 't1', path: 'hp.value', operator: OPERATORS.LTE, value: 0 };
  assert.equal(evaluateTrigger(trigger, { hp: { value: 10 } }, { 'hp.value': 0 }), true);
});

test('evaluateTrigger: does not fire when the update does not touch the trigger\'s path', () => {
  const trigger = { id: 't1', path: 'hp.value', operator: OPERATORS.LTE, value: 0 };
  assert.equal(evaluateTrigger(trigger, { hp: { value: 10 } }, { name: 'renamed' }), false);
});

test('evaluateTrigger: pcOnly skips actors with no player owner', () => {
  const trigger = { id: 't1', path: 'hp.value', operator: OPERATORS.EQ, value: 0, pcOnly: true };
  assert.equal(evaluateTrigger(trigger, { hasPlayerOwner: false, hp: { value: 0 } }, { 'hp.value': 0 }), false);
  assert.equal(evaluateTrigger(trigger, { hasPlayerOwner: true, hp: { value: 0 } }, { 'hp.value': 0 }), true);
});

test('evaluateTrigger: npcOnly skips actors with a player owner', () => {
  const trigger = { id: 't1', path: 'hp.value', operator: OPERATORS.EQ, value: 0, npcOnly: true };
  assert.equal(evaluateTrigger(trigger, { hasPlayerOwner: true, hp: { value: 0 } }, { 'hp.value': 0 }), false);
});

test('evaluateTrigger: notZero skips a left value of exactly 0', () => {
  const trigger = { id: 't1', path: 'hp.value', operator: OPERATORS.LTE, value: 0, notZero: true };
  assert.equal(evaluateTrigger(trigger, {}, { 'hp.value': 0 }), false);
});

test('linkedActionsForTrigger: builds apply/remove condition actions from matching conditions', () => {
  const conditions = [
    { id: 'c1', applyTriggerId: 't1' },
    { id: 'c2', removeTriggerId: 't1' },
    { id: 'c3', applyTriggerId: 'other' }
  ];
  const actions = linkedActionsForTrigger({ id: 't1' }, conditions);
  assert.deepEqual(actions, [
    { type: ACTION_TYPES.APPLY_CONDITION, condition: conditions[0] },
    { type: ACTION_TYPES.REMOVE_CONDITION, condition: conditions[1] }
  ]);
});

test('createDefaultTrigger: builds a normalized trigger with a single apply-condition action', () => {
  const trigger = createDefaultTrigger('t1', 'hp.value', 0, { id: 'bloodied' });
  assert.equal(trigger.id, 't1');
  assert.equal(trigger.operator, OPERATORS.EQ);
  assert.deepEqual(trigger.actions, [{ type: ACTION_TYPES.APPLY_CONDITION, condition: { id: 'bloodied' } }]);
});

function makeAdapter() {
  const calls = [];
  return {
    calls,
    async runAction(target, action, macroRunner) {
      calls.push({ target, action, macroRunner });
      return true;
    }
  };
}

test('TriggerEngine.processUpdate: runs the actions of every trigger that matches', async () => {
  const adapter = makeAdapter();
  const engine = new TriggerEngine({ adapter });
  const trigger = {
    id: 't1',
    path: 'hp.value',
    operator: OPERATORS.LTE,
    value: 0,
    actions: [{ type: ACTION_TYPES.APPLY_CONDITION, condition: { id: 'dead' } }]
  };
  const actor = { id: 'actor1' };
  const matched = await engine.processUpdate({ hp: { value: 10 } }, { 'hp.value': 0 }, [trigger], actor, []);
  assert.equal(matched.length, 1);
  assert.equal(adapter.calls.length, 1);
  assert.equal(adapter.calls[0].target, actor);
  assert.equal(adapter.calls[0].action.type, ACTION_TYPES.APPLY_CONDITION);
});

test('TriggerEngine.processUpdate: skips triggers that do not match, runs none of their actions', async () => {
  const adapter = makeAdapter();
  const engine = new TriggerEngine({ adapter });
  const trigger = { id: 't1', path: 'hp.value', operator: OPERATORS.LTE, value: 0, actions: [{ type: ACTION_TYPES.RUN_MACRO, macroId: 'x' }] };
  const matched = await engine.processUpdate({ hp: { value: 10 } }, { name: 'irrelevant' }, [trigger], {}, []);
  assert.deepEqual(matched, []);
  assert.equal(adapter.calls.length, 0);
});

test('TriggerEngine.processUpdate: also runs linked apply/remove-condition actions for a matched trigger', async () => {
  const adapter = makeAdapter();
  const engine = new TriggerEngine({ adapter });
  const trigger = { id: 't1', path: 'hp.value', operator: OPERATORS.LTE, value: 0, actions: [] };
  const conditions = [{ id: 'bloodied', applyTriggerId: 't1' }];
  await engine.processUpdate({ hp: { value: 10 } }, { 'hp.value': 0 }, [trigger], {}, conditions);
  assert.equal(adapter.calls.length, 1);
  assert.equal(adapter.calls[0].action.type, ACTION_TYPES.APPLY_CONDITION);
  assert.equal(adapter.calls[0].action.condition, conditions[0]);
});

test('TriggerEngine.processUpdate: resolveAction runs a stored condition through conditionResolver', async () => {
  const adapter = makeAdapter();
  const resolved = { id: 'dead', name: 'Dead (resolved)' };
  const engine = new TriggerEngine({ adapter, conditionResolver: () => resolved });
  const trigger = {
    id: 't1',
    path: 'hp.value',
    operator: OPERATORS.LTE,
    value: 0,
    actions: [{ type: ACTION_TYPES.APPLY_CONDITION, condition: { id: 'dead' } }]
  };
  await engine.processUpdate({ hp: { value: 10 } }, { 'hp.value': 0 }, [trigger], {}, []);
  assert.equal(adapter.calls[0].action.condition, resolved);
});

test('TriggerEngine: defaults macroRunner to a no-op when none is supplied', async () => {
  const engine = new TriggerEngine({ adapter: makeAdapter() });
  assert.equal(await engine.macroRunner('some-id'), undefined);
});
