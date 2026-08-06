import assert from "node:assert/strict";
import test from "node:test";

test("main.js: registers hooks against globalThis and re-exports registerHooks", async () => {
  const hooksOnce = [];
  const hooksOn = [];
  globalThis.Hooks = {
    once: (name, fn) => hooksOnce.push({ name, fn }),
    on: (name, fn) => hooksOn.push({ name, fn })
  };
  try {
    const mod = await import(`../main.js?t=${Date.now()}`);
    assert.equal(typeof mod.registerHooks, "function");
    assert.ok(hooksOnce.some((h) => h.name === "init"));
    assert.ok(hooksOnce.some((h) => h.name === "ready"));
    assert.ok(hooksOn.some((h) => h.name === "updateActor"));
    assert.ok(hooksOn.some((h) => h.name === "getSceneControlButtons"));
  } finally {
    delete globalThis.Hooks;
  }
});
