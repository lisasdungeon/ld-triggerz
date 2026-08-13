import { ACTION_TYPES, ACTOR_FLAG_KEYS, MODULE_ID } from "./constants.js";
import { normalizeEffectChanges } from "./EffectValues.js";
import { asArray, makeError } from "./utils.js";

function conditionId(condition) {
  return typeof condition === "string" ? condition : condition?.id;
}

function conditionName(condition, status) {
  return typeof condition === "string" ? status?.name ?? condition : condition?.name ?? status?.name ?? condition?.id;
}

export function conditionAliases(condition, status) {
  const aliases = [
    conditionId(condition),
    typeof condition === "string" ? undefined : condition?.name,
    status?.name,
    status?.label
  ];
  return [...new Set(aliases.filter(Boolean).map(String))];
}

export function effectDocuments(effects) {
  if (!effects) return [];
  if (Array.isArray(effects)) return effects;
  if (typeof effects.values === "function") return [...effects.values()];
  if (Array.isArray(effects.contents)) return effects.contents;
  if (typeof effects.contents?.values === "function") return [...effects.contents.values()];
  if (typeof effects[Symbol.iterator] === "function") return [...effects];
  return [effects];
}

export function effectMatches(effect, condition, status) {
  const aliases = conditionAliases(condition, status);
  const statuses = effect.statuses instanceof Set ? [...effect.statuses] : asArray(effect.statuses);
  const flagConditionId = effect.getFlag?.(MODULE_ID, "conditionId");
  return aliases.some((alias) => statuses.includes(alias) || flagConditionId === alias || effect.name === alias || effect.label === alias);
}

export function makeEffectData(condition, status, options = {}) {
  const id = conditionId(condition);
  return {
    name: conditionName(condition, status),
    img: status?.img ?? condition?.img ?? "icons/svg/aura.svg",
    description: condition?.description ?? "",
    statuses: id ? [id] : [],
    changes: normalizeEffectChanges(condition?.changes),
    disabled: false,
    transfer: options.transfer ?? false,
    flags: {
      "ld-triggerz": {
        conditionId: id,
        source: "condition-adapter"
      }
    }
  };
}

export function conditionHasChanges(condition) {
  return normalizeEffectChanges(condition?.changes).length > 0;
}

export function findConditionForEffect(effect, conditions = [], getStatus = () => undefined) {
  for (const condition of asArray(conditions)) {
    if (!conditionHasChanges(condition)) continue;
    if (effectMatches(effect, condition, getStatus(conditionId(condition)))) return condition;
  }
  return null;
}

export function changesNeedSync(effect, changes) {
  return JSON.stringify(effect?.changes ?? []) !== JSON.stringify(changes ?? []);
}

export async function syncEffectWithCondition(effect, condition) {
  const changes = normalizeEffectChanges(condition?.changes);
  if (!changes.length || !changesNeedSync(effect, changes)) return null;
  if (typeof effect?.update !== "function") return null;
  const id = conditionId(condition);
  return effect.update({
    changes,
    flags: {
      [MODULE_ID]: {
        conditionId: id,
        source: "condition-adapter"
      }
    }
  });
}

export class ConditionAdapter {
  constructor({ config = globalThis.CONFIG } = {}) {
    this.config = config;
  }

  toActor(target) {
    return target?.actor ?? target;
  }

  getStatus(id) {
    return this.config?.statusEffects?.find?.((effect) => effect.id === id);
  }

  hasEffect(actor, condition) {
    return effectDocuments(actor?.effects).some((effect) => effectMatches(effect, condition, this.getStatus(conditionId(condition))));
  }

  findConditionForEffect(effect, conditions = []) {
    return findConditionForEffect(effect, conditions, (id) => this.getStatus(id));
  }

  assignedConditionIds(target) {
    const actor = this.toActor(target);
    const fromGetter = actor?.getFlag?.(MODULE_ID, ACTOR_FLAG_KEYS.ASSIGNED_CONDITIONS);
    const fromData = actor?.flags?.[MODULE_ID]?.[ACTOR_FLAG_KEYS.ASSIGNED_CONDITIONS];
    return asArray(fromGetter ?? fromData).filter(Boolean);
  }

  async assign(target, condition) {
    const actor = this.toActor(target);
    const id = conditionId(condition);
    if (!actor) throw makeError("No actor available for condition assignment.", { id });
    if (!id) throw makeError("Condition assignment requires an id.", { condition });
    if (typeof actor.setFlag !== "function") {
      throw makeError("Actor cannot store condition assignments.", { id });
    }
    const ids = [...new Set([...this.assignedConditionIds(actor), id])];
    await actor.setFlag(MODULE_ID, ACTOR_FLAG_KEYS.ASSIGNED_CONDITIONS, ids);
    return ids;
  }

  async unassign(target, condition) {
    const actor = this.toActor(target);
    const id = conditionId(condition);
    if (!actor) throw makeError("No actor available for condition unassignment.", { id });
    if (!id) throw makeError("Condition unassignment requires an id.", { condition });
    if (typeof actor.setFlag !== "function") {
      throw makeError("Actor cannot store condition assignments.", { id });
    }
    const ids = this.assignedConditionIds(actor).filter((conditionIdValue) => conditionIdValue !== id);
    if (!ids.length && typeof actor.unsetFlag === "function") {
      await actor.unsetFlag(MODULE_ID, ACTOR_FLAG_KEYS.ASSIGNED_CONDITIONS);
      return [];
    }
    await actor.setFlag(MODULE_ID, ACTOR_FLAG_KEYS.ASSIGNED_CONDITIONS, ids);
    return ids;
  }

  async apply(target, condition, options = {}) {
    const actor = this.toActor(target);
    const id = conditionId(condition);
    const status = this.getStatus(id);
    if (!actor) throw makeError("No actor available for condition apply.", { id });

    // Status toggle alone drops ActiveEffect changes. When the condition defines
    // changes, create/sync a full effect so CSB/system props actually update.
    if (conditionHasChanges(condition)) {
      const matching = effectDocuments(actor.effects).filter((effect) => effectMatches(effect, condition, status));
      if (matching.length) {
        const synced = [];
        for (const effect of matching) {
          const result = await syncEffectWithCondition(effect, condition);
          if (result !== null) synced.push(result);
        }
        return synced.length ? synced : matching;
      }
      if (typeof actor.createEmbeddedDocuments !== "function") {
        throw makeError("Actor cannot create ActiveEffect documents.", { id });
      }
      return actor.createEmbeddedDocuments("ActiveEffect", [makeEffectData(condition, status, options)]);
    }

    if (status && typeof actor.toggleStatusEffect === "function") {
      return actor.toggleStatusEffect(id, { active: true, overlay: Boolean(options.overlay) });
    }
    if (typeof actor.createEmbeddedDocuments !== "function") {
      throw makeError("Actor cannot create ActiveEffect documents.", { id });
    }
    return actor.createEmbeddedDocuments("ActiveEffect", [makeEffectData(condition, status, options)]);
  }

  async remove(target, condition) {
    const actor = this.toActor(target);
    const id = conditionId(condition);
    const status = this.getStatus(id);
    if (!actor) throw makeError("No actor available for condition removal.", { id });
    if (status && typeof actor.toggleStatusEffect === "function") {
      return actor.toggleStatusEffect(id, { active: false, overlay: false });
    }
    const removeIds = effectDocuments(actor.effects)
      .filter((effect) => effectMatches(effect, condition, status))
      .map((effect) => effect.id)
      .filter(Boolean);
    if (!removeIds.length) return [];
    if (typeof actor.deleteEmbeddedDocuments !== "function") {
      throw makeError("Actor cannot delete ActiveEffect documents.", { id, removeIds });
    }
    return actor.deleteEmbeddedDocuments("ActiveEffect", removeIds);
  }

  async toggle(target, condition, options = {}) {
    const actor = this.toActor(target);
    const id = conditionId(condition);
    return this.hasEffect(actor, id) ? this.remove(actor, condition) : this.apply(actor, condition, options);
  }

  async runAction(target, action, macroRunner) {
    if (action.type === ACTION_TYPES.APPLY_CONDITION) return this.apply(target, action.condition, action.options);
    if (action.type === ACTION_TYPES.REMOVE_CONDITION) return this.remove(target, action.condition);
    if (action.type === ACTION_TYPES.TOGGLE_CONDITION) return this.toggle(target, action.condition, action.options);
    if (action.type === ACTION_TYPES.RUN_MACRO) return macroRunner(action.macroId, target);
    throw makeError(`Unknown trigger action: ${action.type}`, { action });
  }
}
