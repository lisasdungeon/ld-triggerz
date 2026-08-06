import assert from "node:assert/strict";
import test from "node:test";
import {
  actorAssignedConditionIds,
  assignedConditionLabels,
  buildConditionOptions,
  buildGMHubContext,
  buildSelectedTokens,
  buildStatusOptions,
  buildTriggerOptions,
  cleanStatusLabel,
  statusDisplayLabel,
  summarizeCondition,
  summarizeTrigger
} from "../src/windows/GMHubContext.js";
import { makeDataManager, makeEnv } from "./helpers/mock-foundry.mjs";

test("cleanStatusLabel: strips prefixes and splits camelCase", () => {
  assert.equal(cleanStatusLabel(""), "");
  assert.equal(cleanStatusLabel("EFFECT.StatusBloodied"), "Bloodied");
  assert.equal(cleanStatusLabel("StatusStunned"), "Stunned");
  assert.equal(cleanStatusLabel("some_status-name"), "some status name");
});

test("statusDisplayLabel: localizes dotted keys without spaces", () => {
  const env = {
    game: {
      i18n: {
        has: (key) => key === "EFFECT.StatusStunned",
        localize: () => "Stunned (i18n)"
      }
    }
  };
  assert.equal(statusDisplayLabel({ label: "EFFECT.StatusStunned" }, env), "Stunned (i18n)");
  assert.equal(statusDisplayLabel({ name: "Plain Name" }, env), "Plain Name");
  assert.equal(statusDisplayLabel({ id: "x" }, env), "x");
  assert.equal(statusDisplayLabel(null, env), "");
});

test("statusDisplayLabel: falls back when localize returns raw key", () => {
  const env = { game: { i18n: { has: () => true, localize: (k) => k } } };
  assert.equal(statusDisplayLabel({ label: "EFFECT.StatusFoo" }, env), "Foo");
});

test("buildStatusOptions: maps and sorts by label", () => {
  const env = {
    CONFIG: {
      statusEffects: [
        { id: "b", name: "Beta" },
        { id: "a", name: "Alpha" }
      ]
    },
    game: { i18n: { has: () => false } }
  };
  const options = buildStatusOptions(env);
  assert.deepEqual(options.map((o) => o.value), ["a", "b"]);
});

test("buildConditionOptions: merges saved and status sources", () => {
  const options = buildConditionOptions(
    [{ id: "saved", name: "Saved" }],
    [{ value: "saved", label: "Saved" }, { value: "status", label: "Status" }]
  );
  assert.equal(options.length, 2);
  assert.equal(options[0].source, "saved");
  assert.equal(options[1].source, "status");
});

test("summarizeTrigger: formats action summary", () => {
  const withActions = summarizeTrigger({
    path: "hp",
    operator: "eq",
    value: 0,
    actions: [
      { type: "applyCondition", condition: "bloodied" },
      { type: "removeCondition", condition: "prone" },
      { type: "runMacro", macroId: "m1" }
    ]
  });
  assert.equal(withActions.actionSummary, "bloodied, !prone, m1");
  assert.equal(summarizeTrigger({ path: "x", operator: "eq", value: 1, actions: [] }).actionSummary, "No actions");
  assert.equal(summarizeTrigger({ path: "x", operator: "eq", value: 1, label: "custom", actions: [] }).label, "custom");
});

test("buildTriggerOptions: prefers name - label when distinct", () => {
  const options = buildTriggerOptions([
    { id: "t1", name: "T1", label: "hp eq 0" },
    { id: "t2", name: "t2", label: "t2" }
  ]);
  assert.equal(options[0].label, "T1 - hp eq 0");
  assert.equal(options[1].label, "t2");
});

test("summarizeCondition: change and trigger summaries", () => {
  const labels = new Map([["t1", "Trigger One"]]);
  const one = summarizeCondition({
    id: "c1",
    name: "Bloodied",
    changes: [{ key: "a" }],
    applyTriggerId: "t1",
    removeTriggerId: "missing"
  }, labels);
  assert.equal(one.changeSummary, "1 change");
  assert.equal(one.applyTriggerSummary, "Trigger One");
  assert.equal(one.removeTriggerSummary, "missing");
  const empty = summarizeCondition({ id: "c2" });
  assert.equal(empty.changeSummary, "No changes");
  assert.equal(empty.label, "c2");
  assert.equal(empty.img, "icons/svg/aura.svg");
});

test("actorAssignedConditionIds and assignedConditionLabels", () => {
  const fromGetter = {
    getFlag: () => ["a", "b"]
  };
  assert.deepEqual(actorAssignedConditionIds(fromGetter), ["a", "b"]);
  const fromData = { flags: { "ld-triggerz": { assignedConditions: ["c"] } } };
  assert.deepEqual(actorAssignedConditionIds(fromData), ["c"]);
  assert.deepEqual(
    assignedConditionLabels(["a", "x"], [{ value: "a", label: "Alpha" }]),
    ["Alpha", "x"]
  );
});

test("buildSelectedTokens: maps controlled tokens and assignment summary", () => {
  const env = {
    canvas: {
      tokens: {
        controlled: [
          {
            id: "tok1",
            name: "Goblin",
            actor: {
              getFlag: () => ["bloodied"]
            }
          },
          {
            document: { id: "tok2", name: "Orc", actor: { flags: { "ld-triggerz": { assignedConditions: [] } } } }
          }
        ]
      }
    }
  };
  const tokens = buildSelectedTokens(env, [{ value: "bloodied", label: "Bloodied" }]);
  assert.equal(tokens.length, 2);
  assert.equal(tokens[0].assignmentSummary, "Bloodied");
  assert.equal(tokens[1].assignmentSummary, "No assigned conditions");
});

test("buildGMHubContext: assembles full hub context", () => {
  const env = makeEnv();
  env.game.user.isGM = true;
  const dataManager = makeDataManager({
    triggers: [{ id: "t1", name: "T1", path: "hp.value", operator: "eq", value: 0, actions: [] }],
    conditions: [{ id: "c1", name: "Bloodied", applyTriggerId: "t1", changes: [] }]
  });
  const ctx = buildGMHubContext({ dataManager, env });
  assert.equal(ctx.mode, "GM");
  assert.equal(ctx.triggerCount, 1);
  assert.equal(ctx.conditionCount, 1);
  assert.ok(ctx.pathOptions.length);
  assert.ok(ctx.exportJson.includes("t1"));

  env.game.user.isGM = false;
  assert.equal(buildGMHubContext({ dataManager, env }).mode, "Player");
});
