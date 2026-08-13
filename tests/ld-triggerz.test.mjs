import assert from "node:assert/strict";
import test from "node:test";
import {
  LDTriggerz,
  actorUpdateEntity,
  createGMHubSettingsMenuClass,
  tokenActorEntity,
  tokenActorUpdateData
} from "../src/LDTriggerz.js";
import { makeEnv } from "./helpers/mock-foundry.mjs";

test("tokenActorUpdateData: flattens actorData/delta/_source prefixes", () => {
  const result = tokenActorUpdateData({
    actorData: { system: { hp: { value: 1 } } },
    "delta.system.hp.max": 10,
    "_source.flags.x": 1,
    name: "Goblin"
  });
  assert.equal(result["system.hp.value"], undefined);
  assert.deepEqual(result.system, { hp: { value: 1 } });
  assert.equal(result["system.hp.max"], 10);
  assert.equal(result["flags.x"], 1);
  assert.equal(result.name, "Goblin");
});

test("tokenActorUpdateData: non-object source is ignored", () => {
  assert.deepEqual(tokenActorUpdateData(null), {});
  assert.deepEqual(tokenActorUpdateData(undefined), {});
});

test("actorUpdateEntity: merges document fields and update path data", () => {
  const actor = {
    id: "a1",
    name: "Hero",
    type: "character",
    img: "icon.svg",
    system: { hp: { value: 10 } },
    flags: { x: 1 },
    hasPlayerOwner: true,
    toObject: () => ({ id: "a1", name: "Hero" })
  };
  const entity = actorUpdateEntity(actor, { "system.hp.value": 3, system: { ac: 15 } });
  assert.equal(entity.id, "a1");
  assert.equal(entity.hasPlayerOwner, true);
  assert.equal(entity.system.hp.value, 3);
  assert.equal(entity.system.ac, 15);
});

test("actorUpdateEntity: without toObject uses the document object itself", () => {
  const actor = { id: "a1", system: { hp: 5 }, hasPlayerOwner: false };
  const entity = actorUpdateEntity(actor, { name: "N" });
  assert.equal(entity.id, "a1");
  assert.equal(entity.name, "N");
  assert.equal(entity.hasPlayerOwner, false);
});

test("tokenActorEntity: merges actor, delta, actorData, and update", () => {
  const actor = {
    id: "a1",
    name: "Token Actor",
    system: { hp: { value: 8 } },
    hasPlayerOwner: true,
    toObject: () => ({ id: "a1", system: { hp: { value: 8 } } })
  };
  const tokenDocument = {
    actor,
    delta: { system: { hp: { value: 6 } }, toObject: () => ({ system: { hp: { value: 6 } } }) },
    actorData: { flags: { y: 2 }, toObject: () => ({ flags: { y: 2 } }) }
  };
  const entity = tokenActorEntity(tokenDocument, { "system.hp.value": 2 });
  assert.equal(entity.system.hp.value, 2);
  assert.equal(entity.hasPlayerOwner, true);
  assert.equal(entity.flags.y, 2);
});

test("tokenActorEntity: falls back to token document as actor", () => {
  const tokenDocument = {
    id: "t1",
    system: { hp: { value: 1 } },
    toObject: () => ({ id: "t1", system: { hp: { value: 1 } } })
  };
  const entity = tokenActorEntity(tokenDocument, {});
  assert.equal(entity.id, "t1");
});

test("LDTriggerz.init: wires data, ui, socket, and settings menu", () => {
  const env = makeEnv();
  const tz = new LDTriggerz({ env });
  const instance = tz.init();
  assert.equal(instance, tz);
  assert.ok(tz.uiManager);
  assert.ok(tz.socketHandler);
  assert.equal(env.game.ldTriggerz, tz);
  assert.equal(tz.ready(), tz);
});

test("createGMHubSettingsMenuClass: render opens the GM hub", async () => {
  const env = makeEnv();
  const tz = new LDTriggerz({ env }).init();
  const Menu = createGMHubSettingsMenuClass(tz);
  const menu = new Menu();
  const hub = await menu.render();
  assert.ok(hub);
  assert.equal(tz.uiManager.gmHub, hub);
});

test("LDTriggerz.resolveCondition: resolves by id string or object, falls back", () => {
  const env = makeEnv();
  const tz = new LDTriggerz({ env }).init();
  tz.dataManager.set("conditions", [{ id: "bloodied", name: "Bloodied" }]);
  // set via direct store after register
  env.game.settings.set("ld-triggerz", "conditions", [{ id: "bloodied", name: "Bloodied" }]);
  assert.equal(tz.resolveCondition("bloodied").name, "Bloodied");
  assert.equal(tz.resolveCondition({ id: "bloodied" }).name, "Bloodied");
  assert.deepEqual(tz.resolveCondition({ id: "missing", name: "X" }), { id: "missing", name: "X" });
  assert.deepEqual(tz.resolveCondition({ name: "no-id" }), { name: "no-id" });
});

test("LDTriggerz.processActorUpdate / processTokenUpdate / import export", async () => {
  const env = makeEnv();
  const tz = new LDTriggerz({ env }).init();
  env.game.settings.set("ld-triggerz", "triggers", []);
  env.game.settings.set("ld-triggerz", "conditions", []);

  const matched = await tz.processActorUpdate(
    { id: "a1", system: { hp: { value: 10 } }, hasPlayerOwner: true },
    { "system.hp.value": 0 }
  );
  assert.deepEqual(matched, []);

  const tokenMatched = await tz.processTokenUpdate(
    { actor: { id: "a1", system: { hp: { value: 10 } } } },
    { "system.hp.value": 0 }
  );
  assert.deepEqual(tokenMatched, []);

  const exported = tz.exportData();
  assert.equal(exported.moduleId, "ld-triggerz");
  await tz.importData({ triggers: [{ id: "t1", path: "x", value: 1 }], conditions: [] });
  assert.equal(tz.exportData().triggers.length, 1);
});

test("LDTriggerz.processActiveEffectCreate: syncs saved condition changes onto matching status effects", async () => {
  const env = makeEnv();
  env.CONFIG.statusEffects = [{ id: "stunned", name: "Étourdis" }];
  const tz = new LDTriggerz({ env }).init();
  env.game.settings.set("ld-triggerz", "conditions", [{
    id: "stunned",
    name: "Étourdis",
    changes: [{ key: "system.props.ETO_check", mode: 2, value: "-0.1" }]
  }]);

  assert.equal(await tz.processActiveEffectCreate({ statuses: ["other"], changes: [] }), null);

  const updates = [];
  const effect = {
    id: "e1",
    statuses: ["stunned"],
    changes: [],
    update: async (data) => {
      updates.push(data);
      return data;
    }
  };
  await tz.processActiveEffectCreate(effect);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].changes[0].mode, 2);
  assert.equal(updates[0].changes[0].value, "-0.1");
});

test("mergePathData deep-merge branches via actorUpdateEntity", () => {
  const actor = {
    system: { nested: { a: 1, b: 2 } },
    toObject: () => ({ system: { nested: { a: 1, b: 2 } } })
  };
  const entity = actorUpdateEntity(actor, {
    system: { nested: { b: 9, c: 3 }, other: { z: 1 } }
  });
  assert.equal(entity.system.nested.a, 1);
  assert.equal(entity.system.nested.b, 9);
  assert.equal(entity.system.nested.c, 3);
  assert.equal(entity.system.other.z, 1);
});

test("documentData without object document returns {}", () => {
  assert.deepEqual(actorUpdateEntity(null, {}), {});
});
