export class MockApplicationV2 {
  constructor(options = {}) {
    this.options = options;
    this.element = null;
    this._closed = false;
    this._rendered = false;
  }

  async _prepareContext() {
    return {};
  }

  _onRender() {}

  render() {
    this._rendered = true;
    return this;
  }

  bringToTop() {
    this._broughtToTop = true;
    return this;
  }

  close() {
    this._closed = true;
    return this;
  }
}

export function HandlebarsApplicationMixin(Base) {
  return class extends Base {
    static PARTS = {};
  };
}

export function createApplicationApi() {
  return {
    ApplicationV2: MockApplicationV2,
    HandlebarsApplicationMixin
  };
}

export function makeDataManager({ triggers = [], conditions = [] } = {}) {
  const state = {
    triggers: triggers.map((t) => ({ ...t })),
    conditions: conditions.map((c) => ({ ...c }))
  };
  const settings = {
    enableSceneControl: true,
    debug: false
  };
  return {
    state,
    settings,
    getTriggers: () => state.triggers.map((t) => ({ ...t })),
    getConditions: () => state.conditions.map((c) => ({ ...c })),
    exportData: () => ({
      moduleId: "ld-triggerz",
      triggers: state.triggers.map((t) => ({ ...t })),
      conditions: state.conditions.map((c) => ({ ...c }))
    }),
    importData: async (data) => {
      state.triggers = Array.isArray(data?.triggers) ? data.triggers.map((t) => ({ ...t })) : [];
      state.conditions = Array.isArray(data?.conditions) ? data.conditions.map((c) => ({ ...c })) : [];
      return {
        moduleId: "ld-triggerz",
        triggers: state.triggers,
        conditions: state.conditions
      };
    },
    upsertTrigger: async (trigger) => {
      state.triggers = state.triggers.filter((t) => t.id !== trigger.id);
      state.triggers.push({ ...trigger });
      return { ...trigger };
    },
    upsertCondition: async (condition) => {
      state.conditions = state.conditions.filter((c) => c.id !== condition.id);
      state.conditions.push({ ...condition });
      return { ...condition };
    },
    deleteTrigger: async (id) => {
      state.triggers = state.triggers.filter((t) => t.id !== id);
      return state.triggers;
    },
    deleteCondition: async (id) => {
      state.conditions = state.conditions.filter((c) => c.id !== id);
      return state.conditions;
    },
    get: (key) => settings[key],
    set: async (key, value) => {
      settings[key] = value;
      return value;
    },
    registerSettings: () => 4,
    registerMenu: () => true
  };
}

export function makeEnv(overrides = {}) {
  const notifications = { info: [], warn: [], error: [] };
  const settingsStore = {};
  const menuKeys = [];
  return {
    notifications,
    game: {
      userId: "gm-user",
      user: { id: "gm-user", isGM: true },
      settings: {
        settings: { has: (fullKey) => Object.prototype.hasOwnProperty.call(settingsStore, fullKey) },
        menus: { has: (fullKey) => menuKeys.includes(fullKey) },
        register: (moduleId, key, definition) => {
          settingsStore[`${moduleId}.${key}`] = definition.default;
        },
        registerMenu: (moduleId, key) => menuKeys.push(`${moduleId}.${key}`),
        get: (moduleId, key) => settingsStore[`${moduleId}.${key}`],
        set: (moduleId, key, value) => {
          settingsStore[`${moduleId}.${key}`] = value;
          return value;
        }
      },
      socket: { on: () => {}, emit: () => {} },
      macros: { get: () => undefined },
      i18n: {
        has: () => false,
        localize: (key) => key
      }
    },
    CONFIG: {
      statusEffects: [
        { id: "bloodied", name: "Bloodied", img: "icons/bloodied.svg" },
        { id: "stunned", label: "EFFECT.StatusStunned", img: "icons/stunned.svg" }
      ]
    },
    foundry: {
      applications: {
        api: createApplicationApi(),
        apps: {}
      },
      utils: {
        deepClone: (value) => JSON.parse(JSON.stringify(value))
      }
    },
    ui: {
      notifications: {
        info: (msg) => notifications.info.push(msg),
        warn: (msg) => notifications.warn.push(msg),
        error: (msg) => notifications.error.push(msg)
      }
    },
    canvas: { tokens: { controlled: [] } },
    document: globalThis.document,
    console: { error: () => {}, debug: () => {}, log: () => {} },
    Hooks: { once: () => {}, on: () => {} },
    ...overrides
  };
}
