import { ConditionAdapter } from "./ConditionAdapter.js";
import { DataManager } from "./DataManager.js";
import { MODULE_ID, SETTING_MENU_KEYS } from "./constants.js";
import { SocketHandler } from "./SocketHandler.js";
import { TriggerEngine } from "./TriggerEngine.js";
import { UIManager } from "./UIManager.js";

function normalizeActorUpdatePath(path) {
  let normalized = String(path);
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of ["actorData.", "delta.", "_source."]) {
      if (!normalized.startsWith(prefix)) continue;
      normalized = normalized.slice(prefix.length);
      changed = true;
    }
  }
  return normalized;
}

function mergeActorUpdate(target, source) {
  if (!source || typeof source !== "object") return target;
  for (const [key, value] of Object.entries(source)) {
    if (["actorData", "delta", "_source"].includes(key)) {
      mergeActorUpdate(target, value);
    } else {
      target[normalizeActorUpdatePath(key)] = value;
    }
  }
  return target;
}

function documentData(document) {
  if (!document || typeof document !== "object") return {};
  const data = typeof document.toObject === "function" ? document.toObject() : {};
  for (const key of ["system", "flags", "id", "name", "type", "img"]) {
    if (document[key] !== undefined) data[key] = document[key];
  }
  if (document.hasPlayerOwner !== undefined) data.hasPlayerOwner = document.hasPlayerOwner;
  return typeof document.toObject === "function" ? data : document;
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function setPath(target, path, value) {
  const parts = String(path).split(".");
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    cursor[part] = isObject(cursor[part]) ? cursor[part] : {};
    cursor = cursor[part];
  }
  cursor[parts.at(-1)] = value;
  return target;
}

function mergePathData(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (String(key).includes(".")) {
      setPath(target, key, value);
    } else if (isObject(value) && isObject(target[key])) {
      mergePathData(target[key], value);
    } else if (isObject(value)) {
      target[key] = mergePathData({}, value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

export function tokenActorUpdateData(updateData = {}) {
  return mergeActorUpdate({}, updateData ?? {});
}

export function actorUpdateEntity(actor, updateData = {}) {
  const entity = {};
  mergePathData(entity, documentData(actor));
  mergePathData(entity, updateData ?? {});
  if (actor?.hasPlayerOwner !== undefined) entity.hasPlayerOwner = actor.hasPlayerOwner;
  return entity;
}

export function tokenActorEntity(tokenDocument, updateData = {}) {
  const actor = tokenDocument?.actor ?? tokenDocument;
  const entity = {};
  mergePathData(entity, documentData(actor));
  mergePathData(entity, documentData(tokenDocument?.delta));
  mergePathData(entity, documentData(tokenDocument?.actorData));
  mergePathData(entity, tokenActorUpdateData(updateData));
  if (actor?.hasPlayerOwner !== undefined) entity.hasPlayerOwner = actor.hasPlayerOwner;
  return entity;
}

export function createGMHubSettingsMenuClass(triggerz) {
  const ApplicationV2 = triggerz.env.foundry.applications.api.ApplicationV2;
  return class LDTriggerzGMHubSettingsMenu extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: "ld-triggerz-gm-hub-settings-menu",
      window: { title: "LDTRIGGERZ.GMHub.Title" }
    };

    async render() {
      return triggerz.uiManager.openGMHub({ force: true });
    }
  };
}

export class LDTriggerz {
  constructor({ env = globalThis } = {}) {
    this.env = env;
    this.id = MODULE_ID;
    this.dataManager = new DataManager({ game: env.game, env });
    this.conditionAdapter = new ConditionAdapter({ config: env.CONFIG });
    this.triggerEngine = new TriggerEngine({
      adapter: this.conditionAdapter,
      conditionResolver: (condition) => this.resolveCondition(condition)
    });
    this.uiManager = null;
    this.socketHandler = null;
  }

  init() {
    this.dataManager.registerSettings();
    this.uiManager = new UIManager({
      env: this.env,
      dataManager: this.dataManager,
      conditionAdapter: this.conditionAdapter
    });
    this.dataManager.registerMenu(SETTING_MENU_KEYS.GM_HUB, {
      name: "LDTRIGGERZ.Settings.GMHub.Name",
      label: "LDTRIGGERZ.Settings.GMHub.Label",
      hint: "LDTRIGGERZ.Settings.GMHub.Hint",
      icon: "fa-solid fa-bolt",
      type: createGMHubSettingsMenuClass(this),
      restricted: true
    });
    this.socketHandler = new SocketHandler({
      game: this.env.game,
      dataManager: this.dataManager,
      uiManager: this.uiManager
    });
    this.socketHandler.register();
    this.env.game.ldTriggerz = this;
    return this;
  }

  ready() {
    return this;
  }

  resolveCondition(condition) {
    const id = typeof condition === "string" ? condition : condition?.id;
    if (!id) return condition;
    return this.dataManager.getConditions().find((stored) => stored.id === id) ?? condition;
  }

  async processActorUpdate(actor, updateData) {
    return this.triggerEngine.processUpdate(actorUpdateEntity(actor, updateData), updateData, this.dataManager.getTriggers(), actor, this.dataManager.getConditions());
  }

  async processTokenUpdate(tokenDocument, updateData) {
    const actor = tokenDocument?.actor ?? tokenDocument;
    return this.triggerEngine.processUpdate(tokenActorEntity(tokenDocument, updateData), tokenActorUpdateData(updateData), this.dataManager.getTriggers(), actor, this.dataManager.getConditions());
  }

  exportData() {
    return this.dataManager.exportData();
  }

  importData(data) {
    return this.dataManager.importData(data);
  }
}
