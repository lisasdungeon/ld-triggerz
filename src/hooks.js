import { LDTriggerz } from "./LDTriggerz.js";
import { registerSceneControlHook } from "./hooks/UIHooks.js";
import { patchComputablePhraseForCurrent } from "./CSBActiveEffectPatch.js";
import { errorLog, errorMessage } from "./Logger.js";

let activeInstance = null;

export function getActiveInstance() {
  return activeInstance;
}

export function resetHooksForTests() {
  activeInstance = null;
}

export function initHook(env = globalThis) {
  activeInstance = new LDTriggerz({ env }).init();
  patchComputablePhraseForCurrent(env);
  return activeInstance;
}

export function readyHook(env = globalThis) {
  if (!activeInstance) return false;
  patchComputablePhraseForCurrent(env);
  return activeInstance.ready();
}

export function actorUpdateHook(actor, updateData, _options, userId, env = globalThis) {
  if (env.game.userId !== userId) return false;
  activeInstance.processActorUpdate(actor, updateData).catch((error) => {
    errorLog(env, errorMessage(error, `Failed to process actor update for "${actor?.name ?? actor?.id}".`), error);
  });
  return true;
}

export function tokenUpdateHook(tokenDocument, updateData, _options, userId, env = globalThis) {
  if (env.game.userId !== userId) return false;
  activeInstance.processTokenUpdate(tokenDocument, updateData).catch((error) => {
    errorLog(env, errorMessage(error, `Failed to process token update for "${tokenDocument?.name ?? tokenDocument?.id}".`), error);
  });
  return true;
}

export function activeEffectCreateHook(effect, _options, userId, env = globalThis) {
  if (!activeInstance) return false;
  if (env.game.userId !== userId) return false;
  activeInstance.processActiveEffectCreate(effect).catch((error) => {
    errorLog(env, errorMessage(error, `Failed to sync condition changes for effect "${effect?.name ?? effect?.id}".`), error);
  });
  return true;
}

export function registerHooks(env = globalThis) {
  if (!env.Hooks) return false;
  env.Hooks.once("init", () => initHook(env));
  env.Hooks.once("ready", () => readyHook(env));
  env.Hooks.on("updateActor", (actor, updateData, options, userId) => actorUpdateHook(actor, updateData, options, userId, env));
  env.Hooks.on("updateToken", (tokenDocument, updateData, options, userId) => tokenUpdateHook(tokenDocument, updateData, options, userId, env));
  env.Hooks.on("createActiveEffect", (effect, options, userId) => activeEffectCreateHook(effect, options, userId, env));
  registerSceneControlHook(env, () => activeInstance);
  return true;
}

