function prevent(event) {
  event.preventDefault();
  return event.currentTarget;
}

function selectedCondition(element) {
  const custom = element.querySelector("[data-ld-triggerz-selected-condition-custom]")?.value?.trim();
  return custom || element.querySelector("[data-ld-triggerz-selected-condition]")?.value;
}

function browseIcon(element, env) {
  const input = element?.querySelector("[name='conditionImg']");
  if (!input) return;
  const FP = env?.foundry?.applications?.apps?.FilePicker?.implementation
    ?? env?.foundry?.applications?.apps?.FilePicker
    ?? globalThis.FilePicker;
  if (typeof FP !== "function") return;
  new FP({ type: "image", current: input.value || "icons/svg/", field: input, callback: (path) => { input.value = path; } }).render();
}

function makeOption(doc, value, text) {
  const option = doc.createElement("option");
  option.value = value;
  option.textContent = text;
  return option;
}

function populateTriggerSelects(conditionForm, dataManager, env) {
  if (!conditionForm || !dataManager) return;
  const doc = env?.document ?? globalThis.document;
  if (!doc) return;
  const triggers = dataManager.getTriggers?.() ?? [];
  const applySelect = conditionForm.querySelector("[name='applyTriggerId']");
  const removeSelect = conditionForm.querySelector("[name='removeTriggerId']");
  for (const select of [applySelect, removeSelect]) {
    if (!select) continue;
    const current = select.value;
    select.innerHTML = "";
    select.appendChild(makeOption(doc, "", triggers.length ? "No trigger" : "Save a trigger first"));
    for (const trigger of triggers) {
      const label = trigger.name && trigger.name !== trigger.id
        ? `${trigger.name} - ${trigger.label ?? trigger.id}`
        : (trigger.label ?? trigger.id);
      select.appendChild(makeOption(doc, trigger.id, label));
    }
    if (current) select.value = current;
  }
}

export function bindGMHubEvents({ element, actions, env = globalThis } = {}) {
  const textarea = element.querySelector("[data-ld-triggerz-export]");
  const conditionForm = element.querySelector("[data-ld-triggerz-condition-form]");
  const triggerForm = element.querySelector("[data-ld-triggerz-trigger-form]");
  const buttons = [...element.querySelectorAll("[data-action]")];

  populateTriggerSelects(conditionForm, actions?.dataManager, env);

  conditionForm?.addEventListener("submit", async (event) => {
    await actions.saveConditionFromForm(prevent(event));
  });

  triggerForm?.addEventListener("submit", async (event) => {
    await actions.saveTriggerFromForm(prevent(event));
  });

  for (const button of buttons) {
    button.addEventListener("click", async (event) => {
      const action = event.currentTarget.dataset.action;
      if (action === "browse-icon") { browseIcon(conditionForm, env); return; }
      if (action === "export") actions.exportToTextarea(textarea);
      if (action === "import") await actions.importFromTextarea(textarea);
      if (action === "refresh") actions.refresh();
      if (action === "edit-condition") actions.editCondition(event.currentTarget.dataset.id);
      if (action === "edit-trigger") actions.editTrigger(event.currentTarget.dataset.id);
      if (action === "delete-condition") await actions.deleteCondition(event.currentTarget.dataset.id);
      if (action === "delete-trigger") await actions.deleteTrigger(event.currentTarget.dataset.id);
      if (action === "assign-selected") await actions.assignToSelected(selectedCondition(element));
      if (action === "unassign-selected") await actions.unassignFromSelected(selectedCondition(element));
      if (action === "apply-selected") await actions.applyToSelected("apply", selectedCondition(element));
      if (action === "remove-selected") await actions.applyToSelected("remove", selectedCondition(element));
      if (action === "toggle-selected") await actions.applyToSelected("toggle", selectedCondition(element));
    });
  }
  return buttons.length + Number(Boolean(conditionForm)) + Number(Boolean(triggerForm));
}
