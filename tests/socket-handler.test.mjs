// Slice C: socket-sync functional tests for ld-triggerz.
// Targets SocketHandler - register(), emit(), and receive(payload). The
// constructor takes a fully-injected game/dataManager/uiManager triple so
// every method is testable with plain mock objects.
import assert from 'node:assert/strict';
import test from 'node:test';
import { SocketHandler } from '../src/SocketHandler.js';
import { SOCKET_CHANNEL, SOCKET_EVENTS } from '../src/constants.js';

function makeHarness(userOverrides = {}) {
  const socketHandlers = [];
  const emits = [];
  const renderCalls = [];
  const importCalls = [];
  const users = {
    get: (id) => {
      if (id === 'gm-1') return { id: 'gm-1', isGM: true };
      if (id === 'p1') return { id: 'p1', isGM: false };
      return null;
    },
    contents: [{ id: 'gm-2', isGM: true }]
  };
  const handler = new SocketHandler({
    game: {
      user: { id: 'gm-1', isGM: true, ...userOverrides },
      users,
      socket: {
        on: (channel, fn) => socketHandlers.push({ channel, fn }),
        emit: (channel, payload) => emits.push({ channel, payload }),
      },
    },
    dataManager: {
      importData: async (data) => {
        importCalls.push(data);
        return { ok: true };
      },
    },
    uiManager: {
      renderOpenWindows: () => {
        renderCalls.push('render');
        return 1;
      },
    },
  });
  return { handler, socketHandlers, emits, renderCalls, importCalls };
}

test('SocketHandler.register: attaches to game.socket.on on the canonical channel', () => {
  const { handler, socketHandlers } = makeHarness();
  assert.equal(handler.register(), true);
  assert.equal(socketHandlers.length, 1);
  assert.equal(socketHandlers[0].channel, SOCKET_CHANNEL);
  assert.equal(typeof socketHandlers[0].fn, 'function');
});

test('SocketHandler.register: returns false when game.socket.on is missing', () => {
  const handler = new SocketHandler({ game: {} });
  assert.equal(handler.register(), false);
});

test('SocketHandler.emit: builds the {event,data,recipients} payload and forwards it', () => {
  const { handler, emits } = makeHarness();
  const payload = handler.emit(SOCKET_EVENTS.REFRESH_HUB, { token: 'abc' }, ['user1']);
  assert.equal(emits.length, 1);
  assert.equal(emits[0].channel, SOCKET_CHANNEL);
  assert.deepEqual(emits[0].payload, { event: SOCKET_EVENTS.REFRESH_HUB, data: { token: 'abc' }, recipients: ['user1'], userId: 'gm-1' });
  assert.deepEqual(payload, emits[0].payload);
});

test('SocketHandler.receive: REFRESH_HUB routes to uiManager.renderOpenWindows', async () => {
  const { handler, renderCalls } = makeHarness();
  handler.register();
  await handler.receive({ event: SOCKET_EVENTS.REFRESH_HUB, data: null, userId: 'gm-1' });
  assert.equal(renderCalls.length, 1);
});

test('SocketHandler.receive: IMPORT_DATA forwards data through dataManager then re-renders', async () => {
  const { handler, importCalls, renderCalls } = makeHarness();
  handler.register();
  await handler.receive({ event: SOCKET_EVENTS.IMPORT_DATA, data: { rows: 3 }, userId: 'gm-1' });
  assert.equal(importCalls.length, 1);
  assert.deepEqual(importCalls[0], { rows: 3 });
  assert.equal(renderCalls.length, 1);
});

test('SocketHandler.receive: unknown events return false without touching UI', async () => {
  const { handler, renderCalls, importCalls } = makeHarness();
  handler.register();
  const result = await handler.receive({ event: 'NOT_A_REAL_EVENT', data: null });
  assert.equal(result, false);
  assert.equal(renderCalls.length, 0);
  assert.equal(importCalls.length, 0);
});

test('SocketHandler.receive: the registered socket.on callback is bound to the same receive() function', async () => {
  const { handler, socketHandlers, renderCalls } = makeHarness();
  handler.register();
  // Simulate an inbound payload from the GM's socket - the harness is the
  // same client, so calling the registered fn is equivalent to Foundry
  // invoking the listener.
  await socketHandlers[0].fn({ event: SOCKET_EVENTS.REFRESH_HUB, data: null, userId: 'gm-1' });
  assert.equal(renderCalls.length, 1);
});

test('SocketHandler.receive: ignores privileged events from a player or with no userId', async () => {
  const { handler, renderCalls, importCalls } = makeHarness();
  assert.equal(await handler.receive({ event: SOCKET_EVENTS.REFRESH_HUB, data: null }), false);
  assert.equal(await handler.receive({ event: SOCKET_EVENTS.IMPORT_DATA, data: { rows: 1 }, userId: 'p1' }), false);
  assert.equal(renderCalls.length, 0);
  assert.equal(importCalls.length, 0);
});

test('SocketHandler.receive: accepts a GM resolved from users.contents when get misses', async () => {
  const { handler, renderCalls } = makeHarness();
  handler.game.users.get = () => null;
  assert.equal(await handler.receive({ event: SOCKET_EVENTS.REFRESH_HUB, data: null, userId: 'gm-2' }), 1);
  assert.equal(renderCalls.length, 1);
});

test('SocketHandler.receive: rejects a userId that resolves on neither get nor contents', async () => {
  const { handler, renderCalls } = makeHarness();
  handler.game.users.get = () => null;
  assert.equal(await handler.receive({ event: SOCKET_EVENTS.REFRESH_HUB, data: null, userId: 'nobody' }), false);
  handler.game.users = undefined;
  assert.equal(await handler.receive({ event: SOCKET_EVENTS.IMPORT_DATA, data: {}, userId: 'ghost' }), false);
  assert.equal(renderCalls.length, 0);
});