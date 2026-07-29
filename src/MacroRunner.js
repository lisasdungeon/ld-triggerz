import { debugLog, errorLog, errorMessage } from "./Logger.js";
import { makeError } from "./utils.js";

/**
 * Build the scope object handed to Macro#execute.
 * A TokenDocument target contributes both `token` and `actor`; a bare Actor
 * target contributes only `actor`.
 */
export function macroScope(target) {
  if (!target || typeof target !== "object") return {};
  const scope = {};
  const actor = target.actor ?? target;
  if (actor) scope.actor = actor;
  if (target.actor) scope.token = target;
  return scope;
}

/**
 * Resolve a macro id against the world macro collection.
 * Throws a descriptive error when the id is blank, unknown, or resolves to a
 * document that cannot be executed.
 */
export function resolveMacro(macroId, env = globalThis) {
  const id = String(macroId ?? "").trim();
  if (!id) throw makeError("Run macro action is missing a macro id.", { macroId });
  const collection = env?.game?.macros;
  if (typeof collection?.get !== "function") {
    throw makeError("Foundry macro collection is unavailable.", { macroId: id });
  }
  const macro = collection.get(id);
  if (!macro) throw makeError(`No macro found for id "${id}".`, { macroId: id });
  if (typeof macro.execute !== "function") {
    throw makeError(`Macro "${id}" cannot be executed.`, { macroId: id });
  }
  return macro;
}

/**
 * Create the macroRunner used by TriggerEngine for RUN_MACRO actions.
 * Failures are reported to the console and to the GM rather than thrown, so a
 * single bad macro id cannot abort the remaining actions on a trigger.
 */
export function createMacroRunner(env = globalThis) {
  return async function runMacro(macroId, target) {
    let macro;
    try {
      macro = resolveMacro(macroId, env);
    } catch (error) {
      return errorLog(env, errorMessage(error, "Run macro action failed."), error);
    }
    debugLog(env, "Running macro", { macroId: macro.id ?? macroId, name: macro.name });
    try {
      return await macro.execute(macroScope(target));
    } catch (error) {
      return errorLog(env, `Macro "${macro.name ?? macroId}" threw during execution.`, error);
    }
  };
}
