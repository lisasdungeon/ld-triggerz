import { LDTriggerz } from "./LDTriggerz.js";
import { registerSceneControlHook } from "./hooks/UIHooks.js";

let activeInstance = null;

export function getActiveInstance() {
  return activeInstance;
}

export function resetHooksForTests() {
  activeInstance = null;
}

export function initHook(env = globalThis) {
  activeInstance = new LDTriggerz({ env }).init();
  return activeInstance;
}

export function readyHook() {
  return activeInstance.ready();
}

export function actorUpdateHook(actor, updateData, _options, userId, env = globalThis) {
  if (env.game.userId !== userId) return false;
  activeInstance.processActorUpdate(actor, updateData);
  return true;
}

export function tokenUpdateHook(tokenDocument, updateData, _options, userId, env = globalThis) {
  if (env.game.userId !== userId) return false;
  activeInstance.processTokenUpdate(tokenDocument, updateData);
  return true;
}

export function registerHooks(env = globalThis) {
  if (!env.Hooks) return false;
  env.Hooks.once("init", () => initHook(env));
  env.Hooks.once("ready", () => readyHook());
  env.Hooks.on("updateActor", (actor, updateData, options, userId) => actorUpdateHook(actor, updateData, options, userId, env));
  env.Hooks.on("updateToken", (tokenDocument, updateData, options, userId) => tokenUpdateHook(tokenDocument, updateData, options, userId, env));
  registerSceneControlHook(env, () => activeInstance);
  return true;
}

