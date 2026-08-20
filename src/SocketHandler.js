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

  _isGmSender(payload) {
    const id = payload?.userId;
    if (!id) return false;
    const fromGet = this.game.users?.get?.(id);
    if (fromGet) return Boolean(fromGet.isGM);
    const fromContents = this.game.users?.contents?.find?.((u) => u.id === id);
    return Boolean(fromContents?.isGM);
  }

  emit(event, data, recipients = []) {
    const payload = { event, data, recipients, userId: this.game.user?.id };
    this.game.socket.emit(SOCKET_CHANNEL, payload);
    return payload;
  }

  async receive(payload) {
    if (payload.event === SOCKET_EVENTS.REFRESH_HUB || payload.event === SOCKET_EVENTS.IMPORT_DATA) {
      if (!this._isGmSender(payload)) return false;
    }
    if (payload.event === SOCKET_EVENTS.REFRESH_HUB) return this.uiManager.renderOpenWindows();
    if (payload.event === SOCKET_EVENTS.IMPORT_DATA) {
      await this.dataManager.importData(payload.data);
      return this.uiManager.renderOpenWindows();
    }
    return false;
  }
}

