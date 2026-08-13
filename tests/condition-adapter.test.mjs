import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ConditionAdapter,
  changesNeedSync,
  conditionAliases,
  conditionHasChanges,
  effectDocuments,
  effectMatches,
  findConditionForEffect,
  makeEffectData,
  syncEffectWithCondition
} from '../src/ConditionAdapter.js';
import { ACTION_TYPES } from '../src/constants.js';

test('conditionAliases: collects id, name, and status name/label, de-duplicated', () => {
  const aliases = conditionAliases({ id: 'bloodied', name: 'Bloodied' }, { name: 'Bloodied', label: 'Bloodied' });
  assert.deepEqual(aliases, ['bloodied', 'Bloodied']);
});

test('conditionAliases: a string condition contributes only its id plus status aliases', () => {
  assert.deepEqual(conditionAliases('stunned', { name: 'Stunned' }), ['stunned', 'Stunned']);
});

test('effectDocuments: normalizes an array, a Collection-like object, and a bare object', () => {
  assert.deepEqual(effectDocuments([1, 2]), [1, 2]);
  assert.deepEqual(effectDocuments({ contents: [1, 2] }), [1, 2]);
  assert.deepEqual(effectDocuments({ values: () => [1, 2][Symbol.iterator]() }), [1, 2]);
  assert.deepEqual(effectDocuments(null), []);
  const single = { id: 'x' };
  assert.deepEqual(effectDocuments(single), [single]);
});

test('effectMatches: matches on a status in effect.statuses', () => {
  const effect = { statuses: new Set(['bloodied']) };
  assert.equal(effectMatches(effect, { id: 'bloodied' }), true);
});

test('effectMatches: matches on the module\'s own conditionId flag', () => {
  const effect = { statuses: [], getFlag: (moduleId, key) => (key === 'conditionId' ? 'bloodied' : undefined) };
  assert.equal(effectMatches(effect, { id: 'bloodied' }), true);
});

test('effectMatches: matches on effect.name or effect.label as a last resort', () => {
  assert.equal(effectMatches({ statuses: [], name: 'Bloodied' }, { id: 'bloodied' }, { name: 'Bloodied' }), true);
  assert.equal(effectMatches({ statuses: [], label: 'Bloodied' }, { id: 'bloodied' }, { label: 'Bloodied' }), true);
});

test('effectMatches: false when nothing lines up', () => {
  assert.equal(effectMatches({ statuses: [] }, { id: 'bloodied' }), false);
});

test('makeEffectData: builds a v13-shaped ActiveEffect payload tagged with the module flag', () => {
  const data = makeEffectData({ id: 'bloodied', description: 'Bloodied' }, { img: 'icons/bloodied.svg' });
  assert.equal(data.name, 'bloodied');
  assert.equal(data.img, 'icons/bloodied.svg');
  assert.deepEqual(data.statuses, ['bloodied']);
  assert.equal(data.disabled, false);
  assert.deepEqual(data.flags['ld-triggerz'], { conditionId: 'bloodied', source: 'condition-adapter' });
});

function makeActor({ flags = {}, effects = [], statusEffects = ['bloodied'] } = {}) {
  const flagStore = { 'ld-triggerz': { assignedConditions: [] }, ...flags };
  const calls = { setFlag: [], unsetFlag: [], toggleStatusEffect: [], createEmbeddedDocuments: [], deleteEmbeddedDocuments: [] };
  return {
    calls,
    effects,
    flags: flagStore,
    getFlag: (moduleId, key) => flagStore[moduleId]?.[key],
    setFlag: async (moduleId, key, value) => { calls.setFlag.push({ moduleId, key, value }); flagStore[moduleId] = { ...flagStore[moduleId], [key]: value }; },
    unsetFlag: async (moduleId, key) => { calls.unsetFlag.push({ moduleId, key }); },
    toggleStatusEffect: statusEffects ? async (id, opts) => { calls.toggleStatusEffect.push({ id, opts }); return true; } : undefined,
    createEmbeddedDocuments: async (type, data) => { calls.createEmbeddedDocuments.push({ type, data }); return data; },
    deleteEmbeddedDocuments: async (type, ids) => { calls.deleteEmbeddedDocuments.push({ type, ids }); return ids; }
  };
}

function makeAdapter(statusIds = ['bloodied']) {
  return new ConditionAdapter({ config: { statusEffects: statusIds.map((id) => ({ id, name: id })) } });
}

test('ConditionAdapter.assign/unassign: tracks condition ids on the actor flag, de-duplicated', async () => {
  const adapter = makeAdapter();
  const actor = makeActor();
  await adapter.assign(actor, { id: 'bloodied' });
  await adapter.assign(actor, { id: 'bloodied' });
  assert.deepEqual(adapter.assignedConditionIds(actor), ['bloodied']);
  await adapter.unassign(actor, { id: 'bloodied' });
  assert.equal(actor.calls.unsetFlag.length, 1);
});

test('ConditionAdapter.assign: throws without an actor or without a condition id', async () => {
  const adapter = makeAdapter();
  await assert.rejects(() => adapter.assign(null, { id: 'x' }), /No actor available/);
  await assert.rejects(() => adapter.assign(makeActor(), {}), /requires an id/);
});

test('ConditionAdapter.apply: uses toggleStatusEffect when the id is a real status', async () => {
  const adapter = makeAdapter();
  const actor = makeActor();
  await adapter.apply(actor, { id: 'bloodied' });
  assert.equal(actor.calls.toggleStatusEffect.length, 1);
  assert.deepEqual(actor.calls.toggleStatusEffect[0], { id: 'bloodied', opts: { active: true, overlay: false } });
});

test('ConditionAdapter.apply: status-linked conditions with changes create an ActiveEffect instead of toggling', async () => {
  const adapter = makeAdapter();
  const actor = makeActor();
  const condition = {
    id: 'bloodied',
    name: 'Bloodied',
    changes: [{ key: 'system.props.ETO_check', mode: 2, value: '-0.1' }]
  };
  await adapter.apply(actor, condition);
  assert.equal(actor.calls.toggleStatusEffect.length, 0);
  assert.equal(actor.calls.createEmbeddedDocuments.length, 1);
  const created = actor.calls.createEmbeddedDocuments[0].data[0];
  assert.deepEqual(created.statuses, ['bloodied']);
  assert.equal(created.changes[0].mode, 0);
  assert.equal(created.changes[0].value, '${ current + (-0.1) }$');
});

test('ConditionAdapter.apply: syncs changes onto an existing matching status effect', async () => {
  const adapter = makeAdapter();
  const updates = [];
  const effect = {
    id: 'eff1',
    statuses: ['bloodied'],
    changes: [],
    update: async (data) => {
      updates.push(data);
      return data;
    }
  };
  const actor = makeActor({ effects: [effect] });
  const condition = {
    id: 'bloodied',
    changes: [{ key: 'system.props.ETO_check', mode: 2, value: '-0.1' }]
  };
  const result = await adapter.apply(actor, condition);
  assert.equal(actor.calls.createEmbeddedDocuments.length, 0);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].changes[0].value, '${ current + (-0.1) }$');
  assert.equal(result[0].changes[0].value, '${ current + (-0.1) }$');
});

test('ConditionAdapter.apply: returns existing effects when changes are already synced', async () => {
  const adapter = makeAdapter();
  const changes = [{ key: 'system.props.ETO_check', mode: 0, value: '${ current + (-0.1) }$' }];
  const effect = {
    id: 'eff1',
    statuses: ['bloodied'],
    changes,
    update: async () => {
      throw new Error('should not update');
    }
  };
  const actor = makeActor({ effects: [effect] });
  const result = await adapter.apply(actor, { id: 'bloodied', changes });
  assert.deepEqual(result, [effect]);
});

test('conditionHasChanges / findConditionForEffect / sync helpers', async () => {
  assert.equal(conditionHasChanges(null), false);
  assert.equal(conditionHasChanges({ changes: [] }), false);
  assert.equal(conditionHasChanges({ changes: [{ key: 'x', mode: 0, value: '1' }] }), true);
  assert.equal(changesNeedSync({ changes: [] }, [{ key: 'x' }]), true);
  assert.equal(changesNeedSync({ changes: [{ key: 'x' }] }, [{ key: 'x' }]), false);
  assert.equal(changesNeedSync(null, []), false);
  assert.equal(changesNeedSync({}, null), false);

  const condition = { id: 'bloodied', changes: [{ key: 'system.props.x', mode: 5, value: '1' }] };
  const effect = { statuses: ['bloodied'], changes: [], name: 'Bloodied' };
  assert.equal(findConditionForEffect(effect, [condition], () => ({ id: 'bloodied' }))?.id, 'bloodied');
  assert.equal(findConditionForEffect(effect, [{ id: 'other' }], () => undefined), null);
  assert.equal(findConditionForEffect(effect), null);
  assert.equal(findConditionForEffect(effect, [{ id: 'bloodied', changes: [] }, condition])?.id, 'bloodied');
  assert.equal(await syncEffectWithCondition({ changes: [] }, { changes: [] }), null);
  assert.equal(await syncEffectWithCondition(null, condition), null);
  assert.equal(await syncEffectWithCondition({ changes: [{ key: 'x' }], update: undefined }, condition), null);
});

test('ConditionAdapter.apply: falls back to creating an ActiveEffect for a homebrew condition', async () => {
  const adapter = makeAdapter([]);
  const actor = makeActor({ statusEffects: null });
  actor.toggleStatusEffect = undefined;
  await adapter.apply(actor, { id: 'homebrew-condition', name: 'Homebrew' });
  assert.equal(actor.calls.createEmbeddedDocuments.length, 1);
  assert.equal(actor.calls.createEmbeddedDocuments[0].type, 'ActiveEffect');
});

test('ConditionAdapter.apply: throws when there is no way to create the effect', async () => {
  const adapter = makeAdapter([]);
  const actor = makeActor();
  actor.toggleStatusEffect = undefined;
  actor.createEmbeddedDocuments = undefined;
  await assert.rejects(() => adapter.apply(actor, { id: 'x' }), /cannot create ActiveEffect/);
});

test('ConditionAdapter.remove: uses toggleStatusEffect for a real status', async () => {
  const adapter = makeAdapter();
  const actor = makeActor();
  await adapter.remove(actor, { id: 'bloodied' });
  assert.deepEqual(actor.calls.toggleStatusEffect[0], { id: 'bloodied', opts: { active: false, overlay: false } });
});

test('ConditionAdapter.remove: deletes matching homebrew ActiveEffects when there is no status', async () => {
  const adapter = makeAdapter([]);
  const effect = { id: 'eff1', statuses: [], getFlag: (m, k) => (k === 'conditionId' ? 'homebrew' : undefined) };
  const actor = makeActor({ effects: [effect] });
  actor.toggleStatusEffect = undefined;
  await adapter.remove(actor, { id: 'homebrew' });
  assert.deepEqual(actor.calls.deleteEmbeddedDocuments[0], { type: 'ActiveEffect', ids: ['eff1'] });
});

test('ConditionAdapter.remove: no-ops (returns []) when nothing matches', async () => {
  const adapter = makeAdapter([]);
  const actor = makeActor();
  actor.toggleStatusEffect = undefined;
  const result = await adapter.remove(actor, { id: 'not-present' });
  assert.deepEqual(result, []);
});

test('ConditionAdapter.toggle: applies when absent, removes when present', async () => {
  const adapter = makeAdapter();
  const actor = makeActor();
  await adapter.toggle(actor, { id: 'bloodied' });
  assert.equal(actor.calls.toggleStatusEffect[0].opts.active, true);
});

test('ConditionAdapter.runAction: dispatches to apply/remove/toggle/macro by action type', async () => {
  const adapter = makeAdapter();
  const actor = makeActor();
  await adapter.runAction(actor, { type: ACTION_TYPES.APPLY_CONDITION, condition: { id: 'bloodied' } });
  assert.equal(actor.calls.toggleStatusEffect.length, 1);

  const macroCalls = [];
  const macroRunner = async (macroId, target) => macroCalls.push({ macroId, target });
  await adapter.runAction(actor, { type: ACTION_TYPES.RUN_MACRO, macroId: 'm1' }, macroRunner);
  assert.deepEqual(macroCalls, [{ macroId: 'm1', target: actor }]);
});

test('ConditionAdapter.runAction: throws on an unknown action type', async () => {
  const adapter = makeAdapter();
  await assert.rejects(() => adapter.runAction(makeActor(), { type: 'not-a-real-action' }), /Unknown trigger action/);
});
