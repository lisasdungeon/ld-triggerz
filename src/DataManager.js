import { DEFAULT_SETTINGS, MODULE_ID, SETTING_KEYS } from "./constants.js";
import { cloneData, makeError } from "./utils.js";

export const SETTING_DEFINITIONS = [
  {
    key: SETTING_KEYS.ENABLE_SCENE_CONTROL,
    scope: "world",
    config: true,
    type: Boolean,
    name: "LDTRIGGERZ.Settings.EnableSceneControl.Name",
    hint: "LDTRIGGERZ.Settings.EnableSceneControl.Hint",
    requiresReload: true
  },
  {
    key: SETTING_KEYS.TRIGGERS,
    scope: "world",
    config: false,
    type: Array
  },
  {
    key: SETTING_KEYS.CONDITIONS,
    scope: "world",
    config: false,
    type: Array
  },
  {
    key: SETTING_KEYS.DEBUG,
    scope: "world",
    config: true,
    type: Boolean,
    name: "LDTRIGGERZ.Settings.Debug.Name",
    hint: "LDTRIGGERZ.Settings.Debug.Hint"
  }
];

export class DataManager {
  constructor({ game = globalThis.game, moduleId = MODULE_ID, env = globalThis } = {}) {
    this.game = game;
    this.moduleId = moduleId;
    this.env = env;
  }

  requireSettings() {
    if (!this.game?.settings) throw new Error("LD Triggerz requires Foundry game.settings.");
    return this.game.settings;
  }

  registerSettings() {
    const settings = this.requireSettings();
    for (const definition of SETTING_DEFINITIONS) {
      const fullKey = `${this.moduleId}.${definition.key}`;
      if (settings.settings?.has?.(fullKey)) continue;
      settings.register(this.moduleId, definition.key, {
        ...definition,
        default: cloneData(DEFAULT_SETTINGS[definition.key], this.env)
      });
    }
    return SETTING_DEFINITIONS.length;
  }

  registerMenu(key, definition) {
    const settings = this.requireSettings();
    const fullKey = `${this.moduleId}.${key}`;
    if (settings.menus?.has?.(fullKey)) return false;
    if (typeof settings.registerMenu !== "function") return false;
    settings.registerMenu(this.moduleId, key, definition);
    return true;
  }

  get(key) {
    const value = this.requireSettings().get(this.moduleId, key);
    return cloneData(value, this.env);
  }

  async set(key, value) {
    return this.requireSettings().set(this.moduleId, key, cloneData(value, this.env));
  }

  getTriggers() {
    return this.get(SETTING_KEYS.TRIGGERS) ?? [];
  }

  async saveTriggers(triggers) {
    return this.set(SETTING_KEYS.TRIGGERS, Array.isArray(triggers) ? triggers : []);
  }

  async upsertTrigger(trigger) {
    if (!trigger?.id) throw makeError("Trigger requires an id.", { trigger });
    const triggers = this.getTriggers().filter((existing) => existing.id !== trigger.id);
    triggers.push(cloneData(trigger, this.env));
    await this.saveTriggers(triggers);
    return cloneData(trigger, this.env);
  }

  async deleteTrigger(id) {
    const triggers = this.getTriggers().filter((trigger) => trigger.id !== id);
    await this.saveTriggers(triggers);
    return triggers;
  }

  getConditions() {
    return this.get(SETTING_KEYS.CONDITIONS) ?? [];
  }

  async saveConditions(conditions) {
    return this.set(SETTING_KEYS.CONDITIONS, Array.isArray(conditions) ? conditions : []);
  }

  async upsertCondition(condition) {
    if (!condition?.id) throw makeError("Condition requires an id.", { condition });
    const conditions = this.getConditions().filter((existing) => existing.id !== condition.id);
    conditions.push(cloneData(condition, this.env));
    await this.saveConditions(conditions);
    return cloneData(condition, this.env);
  }

  async deleteCondition(id) {
    const conditions = this.getConditions().filter((condition) => condition.id !== id);
    await this.saveConditions(conditions);
    return conditions;
  }

  exportData() {
    return {
      moduleId: this.moduleId,
      triggers: this.getTriggers(),
      conditions: this.getConditions()
    };
  }

  async importData(data) {
    await this.saveTriggers(data?.triggers);
    await this.saveConditions(data?.conditions);
    return this.exportData();
  }
}
