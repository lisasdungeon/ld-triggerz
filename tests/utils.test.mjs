import assert from 'node:assert/strict';
import test from 'node:test';
import { asArray, cloneData, getProperty, hasProperty, localize, makeError } from '../src/utils.js';

test('cloneData: prefers foundry.utils.deepClone when available', () => {
  const seen = [];
  const env = { foundry: { utils: { deepClone: (value) => { seen.push(value); return { ...value, cloned: true }; } } } };
  const result = cloneData({ a: 1 }, env);
  assert.deepEqual(result, { a: 1, cloned: true });
  assert.deepEqual(seen, [{ a: 1 }]);
});

test('cloneData: falls back to structuredClone, then JSON round-trip', () => {
  assert.deepEqual(cloneData({ a: 1 }, {}), { a: 1 });
  assert.deepEqual(cloneData([1, 2, 3], { structuredClone: undefined }), [1, 2, 3]);
});

test('cloneData: undefined passes through as undefined', () => {
  assert.equal(cloneData(undefined, {}), undefined);
});

test('asArray: wraps a scalar, passes an array through, treats null/undefined as empty', () => {
  assert.deepEqual(asArray('x'), ['x']);
  assert.deepEqual(asArray([1, 2]), [1, 2]);
  assert.deepEqual(asArray(null), []);
  assert.deepEqual(asArray(undefined), []);
});

test('getProperty: reads a literal flat key before treating it as a dotted path', () => {
  assert.equal(getProperty({ 'system.hp.value': 5 }, 'system.hp.value'), 5);
});

test('getProperty: walks a dotted path when no literal key exists', () => {
  assert.equal(getProperty({ system: { hp: { value: 7 } } }, 'system.hp.value'), 7);
});

test('getProperty: returns undefined when a path segment is missing', () => {
  assert.equal(getProperty({ system: {} }, 'system.hp.value'), undefined);
});

test('getProperty: a falsy path (null, empty string) returns the source itself', () => {
  const source = { a: 1 };
  assert.equal(getProperty(source, null), source);
  assert.equal(getProperty(source, ''), source);
});

test('hasProperty: true only when getProperty resolves to a defined value', () => {
  assert.equal(hasProperty({ a: { b: 1 } }, 'a.b'), true);
  assert.equal(hasProperty({ a: {} }, 'a.b'), false);
});

test('localize: returns the localized string when game.i18n has the key', () => {
  const env = { game: { i18n: { has: () => true, localize: (key) => `translated:${key}` } } };
  assert.equal(localize('LDTRIGGERZ.Foo', 'fallback', env), 'translated:LDTRIGGERZ.Foo');
});

test('localize: falls back when the key is missing or i18n is unavailable', () => {
  const env = { game: { i18n: { has: () => false } } };
  assert.equal(localize('LDTRIGGERZ.Foo', 'fallback', env), 'fallback');
  assert.equal(localize('LDTRIGGERZ.Foo', 'fallback', {}), 'fallback');
});

test('makeError: builds an Error carrying a details payload', () => {
  const error = makeError('boom', { id: 'x' });
  assert.ok(error instanceof Error);
  assert.equal(error.message, 'boom');
  assert.deepEqual(error.details, { id: 'x' });
});
