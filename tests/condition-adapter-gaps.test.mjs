import assert from "node:assert/strict";
import test from "node:test";
import { ConditionAdapter, effectDocuments, makeEffectData } from "../src/ConditionAdapter.js";
import { ACTION_TYPES } from "../src/constants.js";

function makeActor({ flags = {}, effects = [], withSetFlag = true, withDelete = true } = {}) {
  const flagStore = { "ld-triggerz": { assignedConditions: [] }, ...flags };
  const calls = { setFlag: [], unsetFlag: [], deleteEmbeddedDocuments: [], createEmbeddedDocuments: [] };
  const actor = {
    calls,
    effects,
    flags: flagStore,
    getFlag: (moduleId, key) => flagStore[moduleId]?.[key],
    createEmbeddedDocuments: async (type, data) => {
      calls.createEmbeddedDocuments.push({ type, data });
      return data;
    }
  };
  if (withSetFlag) {
    actor.setFlag = async (moduleId, key, value) => {
      calls.setFlag.push({ moduleId, key, value });
      flagStore[moduleId] = { ...flagStore[moduleId], [key]: value };
    };
    actor.unsetFlag = async (moduleId, key) => {
      calls.unsetFlag.push({ moduleId, key });
      if (flagStore[moduleId]) delete flagStore[moduleId][key];
    };
  }
  if (withDelete) {
    actor.deleteEmbeddedDocuments = async (type, ids) => {
      calls.deleteEmbeddedDocuments.push({ type, ids });
      return ids;
    };
  }
  return actor;
}

test("assign: throws when actor cannot store flags", async () => {
  const adapter = new ConditionAdapter({ config: { statusEffects: [] } });
  const actor = makeActor({ withSetFlag: false });
  await assert.rejects(() => adapter.assign(actor, { id: "bloodied" }), /cannot store condition assignments/);
});

test("unassign: throws when actor cannot store flags", async () => {
  const adapter = new ConditionAdapter({ config: { statusEffects: [] } });
  const actor = makeActor({ withSetFlag: false });
  await assert.rejects(() => adapter.unassign(actor, { id: "bloodied" }), /cannot store condition assignments/);
});

test("unassign: keeps remaining ids via setFlag when list is non-empty", async () => {
  const adapter = new ConditionAdapter({ config: { statusEffects: [] } });
  const actor = makeActor({
    flags: { "ld-triggerz": { assignedConditions: ["a", "b"] } }
  });
  const remaining = await adapter.unassign(actor, { id: "a" });
  assert.deepEqual(remaining, ["b"]);
  assert.equal(actor.calls.setFlag.length, 1);
  assert.deepEqual(actor.calls.setFlag[0].value, ["b"]);
  assert.equal(actor.calls.unsetFlag.length, 0);
});

test("unassign: throws without actor or without condition id", async () => {
  const adapter = new ConditionAdapter({ config: { statusEffects: [] } });
  await assert.rejects(() => adapter.unassign(null, { id: "x" }), /No actor available/);
  await assert.rejects(() => adapter.unassign(makeActor(), {}), /requires an id/);
});

test("remove: throws when matching effects exist but deleteEmbeddedDocuments is missing", async () => {
  const adapter = new ConditionAdapter({ config: { statusEffects: [] } });
  const effect = {
    id: "eff1",
    statuses: [],
    getFlag: (_m, k) => (k === "conditionId" ? "homebrew" : undefined)
  };
  const actor = makeActor({ effects: [effect], withDelete: false });
  actor.toggleStatusEffect = undefined;
  await assert.rejects(
    () => adapter.remove(actor, { id: "homebrew" }),
    /cannot delete ActiveEffect/
  );
});

test("remove: throws without an actor", async () => {
  const adapter = new ConditionAdapter({ config: { statusEffects: [] } });
  await assert.rejects(() => adapter.remove(null, { id: "x" }), /No actor available/);
});

test("apply: throws without an actor", async () => {
  const adapter = new ConditionAdapter({ config: { statusEffects: [] } });
  await assert.rejects(() => adapter.apply(null, { id: "x" }), /No actor available/);
});

test("apply: honors overlay option on toggleStatusEffect", async () => {
  const adapter = new ConditionAdapter({ config: { statusEffects: [{ id: "bloodied" }] } });
  const calls = [];
  const actor = {
    effects: [],
    toggleStatusEffect: async (id, opts) => {
      calls.push({ id, opts });
      return true;
    }
  };
  await adapter.apply(actor, { id: "bloodied" }, { overlay: true });
  assert.deepEqual(calls[0], { id: "bloodied", opts: { active: true, overlay: true } });
});

test("apply: throws when a changed condition cannot create an ActiveEffect", async () => {
  const adapter = new ConditionAdapter({ config: { statusEffects: [{ id: "bloodied" }] } });
  const actor = {
    effects: [],
    toggleStatusEffect: async () => true
  };
  await assert.rejects(
    () => adapter.apply(actor, {
      id: "bloodied",
      changes: [{ key: "system.props.ETO_check", mode: 2, value: "-0.1" }]
    }),
    /cannot create ActiveEffect/
  );
});

test("findConditionForEffect: uses adapter status lookup", () => {
  const adapter = new ConditionAdapter({ config: { statusEffects: [{ id: "bloodied", name: "Bloodied" }] } });
  const condition = { id: "bloodied", changes: [{ key: "system.props.x", mode: 5, value: "1" }] };
  const effect = { statuses: ["bloodied"], changes: [] };
  assert.equal(adapter.findConditionForEffect(effect, [condition])?.id, "bloodied");
  assert.equal(adapter.findConditionForEffect(effect, []), null);
});

test("toActor: unwraps token-shaped targets", () => {
  const adapter = new ConditionAdapter({ config: { statusEffects: [] } });
  const actor = { id: "a1" };
  assert.equal(adapter.toActor({ actor }), actor);
  assert.equal(adapter.toActor(actor), actor);
});

test("assignedConditionIds: reads flags data when getFlag is absent", () => {
  const adapter = new ConditionAdapter({ config: { statusEffects: [] } });
  const actor = { flags: { "ld-triggerz": { assignedConditions: ["x"] } } };
  assert.deepEqual(adapter.assignedConditionIds(actor), ["x"]);
});

test("effectDocuments: iterates contents.values and bare iterators", () => {
  const valuesIter = {
    contents: {
      values: () => [1, 2][Symbol.iterator]()
    }
  };
  assert.deepEqual(effectDocuments(valuesIter), [1, 2]);
  assert.deepEqual(effectDocuments({ [Symbol.iterator]: function* () { yield 9; } }), [9]);
});

test("makeEffectData: falls back when no status img and condition has no id", () => {
  const data = makeEffectData({ name: "Nameless", img: "icons/custom.svg", description: "d" }, null, { transfer: true });
  assert.equal(data.name, "Nameless");
  assert.equal(data.img, "icons/custom.svg");
  assert.deepEqual(data.statuses, []);
  assert.equal(data.transfer, true);
});

test("runAction: dispatches remove and toggle", async () => {
  const adapter = new ConditionAdapter({ config: { statusEffects: [{ id: "bloodied", name: "Bloodied" }] } });
  const calls = [];
  const actor = {
    effects: [{ statuses: new Set(["bloodied"]), id: "e1" }],
    toggleStatusEffect: async (id, opts) => {
      calls.push({ id, opts });
      return true;
    }
  };
  await adapter.runAction(actor, { type: ACTION_TYPES.REMOVE_CONDITION, condition: { id: "bloodied" } });
  assert.equal(calls[0].opts.active, false);
  await adapter.runAction(actor, { type: ACTION_TYPES.TOGGLE_CONDITION, condition: { id: "bloodied" } });
  assert.equal(calls.length, 2);
});

test("hasEffect: detects matching status effect", () => {
  const adapter = new ConditionAdapter({ config: { statusEffects: [{ id: "bloodied" }] } });
  const actor = { effects: [{ statuses: new Set(["bloodied"]) }] };
  assert.equal(adapter.hasEffect(actor, { id: "bloodied" }), true);
  assert.equal(adapter.hasEffect({ effects: [] }, { id: "bloodied" }), false);
});

test("getStatus: returns undefined for unknown ids", () => {
  const adapter = new ConditionAdapter({ config: { statusEffects: [{ id: "bloodied" }] } });
  assert.equal(adapter.getStatus("missing"), undefined);
  assert.equal(adapter.getStatus("bloodied").id, "bloodied");
});
