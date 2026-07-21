import { MODULE_ID, SETTING_KEYS } from "../constants.js";
import { localize } from "../utils.js";

export function createOpenHubTool(triggerz, env = globalThis) {
  return {
    name: "openHub",
    title: localize("LDTRIGGERZ.SceneControl.OpenHub", "Open LD Triggerz", env),
    icon: "fas fa-bolt",
    button: true,
    toggle: false,
    onChange: (active) => {
      if (!active) return;
      triggerz.uiManager.openGMHub();
    }
  };
}

export function createControlGroup(tool, controls) {
  return {
    name: MODULE_ID,
    title: "LD Triggerz",
    icon: "fas fa-bolt",
    order: 100,
    layer: "tokens",
    visible: true,
    tools: Array.isArray(controls) ? [tool] : { [tool.name]: tool }
  };
}

export function injectControlGroup(controls, group) {
  if (Array.isArray(controls)) {
    const existingIndex = controls.findIndex((control) => control.name === group.name);
    if (existingIndex >= 0) controls[existingIndex] = group;
    else controls.push(group);
    return controls;
  }
  controls[group.name] = group;
  return controls;
}

export function sceneControlEnabled(triggerz) {
  if (!triggerz?.dataManager || typeof triggerz.dataManager.get !== "function") return true;
  return triggerz.dataManager.get(SETTING_KEYS.ENABLE_SCENE_CONTROL) !== false;
}

export function registerSceneControlHook(env = globalThis, getTriggerz) {
  env.Hooks.on("getSceneControlButtons", (controls) => {
    const triggerz = getTriggerz();
    if (!triggerz || !sceneControlEnabled(triggerz)) return controls;
    const tool = createOpenHubTool(triggerz, env);
    return injectControlGroup(controls, createControlGroup(tool, controls));
  });
}
