export function cloneData(value, env = globalThis) {
  if (value === undefined) return undefined;
  if (env.foundry?.utils?.deepClone) return env.foundry.utils.deepClone(value);
  if (typeof env.structuredClone === "function") return env.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export function getProperty(source, path) {
  if (!path) return source;
  if (Object.prototype.hasOwnProperty.call(source ?? {}, path)) return source[path];
  const parts = String(path).split(".");
  let cursor = source;
  for (const part of parts) {
    if (cursor === undefined || cursor === null) return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

export function hasProperty(source, path) {
  return getProperty(source, path) !== undefined;
}

export function localize(key, fallback = key, env = globalThis) {
  if (env.game?.i18n?.has?.(key)) return env.game.i18n.localize(key);
  return fallback;
}

export function makeError(message, details = {}) {
  const error = new Error(message);
  error.details = details;
  return error;
}
