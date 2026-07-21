import { SOCKET_CHANNEL, SOCKET_EVENTS } from "./constants.js";

export class SocketHandler {
  constructor({ game = globalThis.game, dataManager, uiManager } = {}) {
    this.game = game;
    this.dataManager = dataManager;
    this.uiManager = uiManager;
  }

  register() {
    if (!this.game?.socket?.on) return false;
    this.game.socket.on(SOCKET_CHANNEL, (payload) => this.receive(payload));
    return true;
  }

  emit(event, data, recipients = []) {
    const payload = { event, data, recipients };
    this.game.socket.emit(SOCKET_CHANNEL, payload);
    return payload;
  }

  async receive(payload) {
    if (payload.event === SOCKET_EVENTS.REFRESH_HUB) return this.uiManager.renderOpenWindows();
    if (payload.event === SOCKET_EVENTS.IMPORT_DATA) {
      await this.dataManager.importData(payload.data);
      return this.uiManager.renderOpenWindows();
    }
    return false;
  }
}

