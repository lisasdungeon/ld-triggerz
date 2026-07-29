import assert from 'node:assert/strict';
import test from 'node:test';
import { debugLog, errorLog, errorMessage, isDebugEnabled } from '../src/Logger.js';
import { MODULE_ID, SETTING_KEYS } from '../src/constants.js';

function envWithDebug(enabled) {
  return {
    game: {
      settings: {
        get: (moduleId, key) => {
          if (moduleId === MODULE_ID && key === SETTING_KEYS.DEBUG) return enabled;
          throw new Error(`unexpected settings.get(${moduleId}, ${key})`);
        }
      }
    }
  };
}

test('isDebugEnabled: reflects the Debug Logging world setting', () => {
  assert.equal(isDebugEnabled(envWithDebug(true)), true);
  assert.equal(isDebugEnabled(envWithDebug(false)), false);
});

test('isDebugEnabled: false when settings are unavailable or throw', () => {
  assert.equal(isDebugEnabled({}), false);
  assert.equal(isDebugEnabled({ game: { settings: { get: () => { throw new Error('nope'); } } } }), false);
});

test('debugLog: writes nothing when Debug Logging is off', () => {
  const calls = [];
  const env = { ...envWithDebug(false), console: { debug: (...args) => calls.push(args) } };
  assert.equal(debugLog(env, 'hello'), false);
  assert.equal(calls.length, 0);
});

test('debugLog: writes a prefixed line when Debug Logging is on', () => {
  const calls = [];
  const env = { ...envWithDebug(true), console: { debug: (...args) => calls.push(args) } };
  assert.equal(debugLog(env, 'hello', { detail: 1 }), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'LD Triggerz | hello');
  assert.deepEqual(calls[0][1], { detail: 1 });
});

test('debugLog: falls back to console.log when console.debug is unavailable', () => {
  const calls = [];
  const env = { ...envWithDebug(true), console: { log: (...args) => calls.push(args) } };
  assert.equal(debugLog(env, 'hello'), true);
  assert.equal(calls.length, 1);
});

test('errorLog: always logs to console.error and returns false', () => {
  const calls = [];
  const env = { console: { error: (...args) => calls.push(args) } };
  const error = new Error('boom');
  assert.equal(errorLog(env, 'Something broke.', error), false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'LD Triggerz | Something broke.');
  assert.equal(calls[0][1], error);
});

test('errorLog: also notifies the GM via ui.notifications.error when available', () => {
  const notifications = [];
  const env = {
    console: { error: () => {} },
    ui: { notifications: { error: (message) => notifications.push(message) } }
  };
  errorLog(env, 'Something broke.', new Error('boom'));
  assert.deepEqual(notifications, ['LD Triggerz: Something broke.']);
});

test('errorMessage: prefers the error message, falls back when blank or missing', () => {
  assert.equal(errorMessage(new Error('real message'), 'fallback'), 'real message');
  assert.equal(errorMessage(new Error('   '), 'fallback'), 'fallback');
  assert.equal(errorMessage({}, 'fallback'), 'fallback');
  assert.equal(errorMessage(null, 'fallback'), 'fallback');
});
