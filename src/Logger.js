import { MODULE_ID, MODULE_TITLE, SETTING_KEYS } from "./constants.js";

const LOG_PREFIX = `${MODULE_TITLE} |`;

function consoleFor(env) {
  return env?.console ?? globalThis.console;
}

/**
 * Read the Debug Logging world setting.
 * Resolved lazily at call time so nothing is read before settings registration,
 * and so toggling the setting takes effect without a reload.
 */
export function isDebugEnabled(env = globalThis) {
  const getter = env?.game?.settings?.get;
  if (typeof getter !== "function") return false;
  try {
    return env.game.settings.get(MODULE_ID, SETTING_KEYS.DEBUG) === true;
  } catch {
    return false;
  }
}

/**
 * Emit a diagnostic line only when Debug Logging is enabled.
 * Returns true when a line was written, false when logging was suppressed.
 */
export function debugLog(env, message, details) {
  if (!isDebugEnabled(env)) return false;
  const target = consoleFor(env);
  const write = target?.debug ?? target?.log;
  if (typeof write !== "function") return false;
  if (details === undefined) write.call(target, `${LOG_PREFIX} ${message}`);
  else write.call(target, `${LOG_PREFIX} ${message}`, details);
  return true;
}

/**
 * Surface a failure to the console and, when available, to the GM as a
 * Foundry error notification. Always returns false so callers can
 * `return errorLog(...)` from a failure branch.
 */
export function errorLog(env, message, error) {
  const target = consoleFor(env);
  if (typeof target?.error === "function") target.error(`${LOG_PREFIX} ${message}`, error);
  const notify = env?.ui?.notifications?.error;
  if (typeof notify === "function") notify.call(env.ui.notifications, `${MODULE_TITLE}: ${message}`);
  return false;
}

export function errorMessage(error, fallback) {
  const message = typeof error?.message === "string" ? error.message.trim() : "";
  return message || fallback;
}
