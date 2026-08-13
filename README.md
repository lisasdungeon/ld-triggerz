# LD Triggerz

**System-agnostic trigger automation and condition control for Foundry VTT.**

LD Triggerz lets you build reactive rules that watch actor and token data, then automatically apply, remove, or toggle conditions - or run a macro - when the data crosses the threshold you set. No scripting required.

- HP drops below half? Apply **Bloodied** automatically.
- HP hits zero? Apply **Unconscious**.
- A stat recovers above a threshold? Remove the condition on its own.
- Need a custom macro? Fire it when a specific value changes.

---

## Features

- **Visual GM Hub** - build triggers and conditions directly inside Foundry, no JSON editing.
- **Condition Builder** - create custom conditions with names, icons, descriptions, and Foundry ActiveEffect changes.
- **Trigger Builder** - watch any actor data path, compare it to a value, percentage, or another path, then fire an action.
- **Condition Linking** - wire a condition to an Apply Trigger and a Remove Trigger so full workflows run hands-free.
- **Foundry ActiveEffect Support** - set change keys, modes, values, and priority right from the hub.
- **Custom System Builder (CSB) Support** - native `system.props` path math is normalized automatically. See [docs/CSB-Effect-Changes.md](docs/CSB-Effect-Changes.md) for formula examples.
- **Scope Filtering** - fire on all actors, PCs only, or NPCs only.
- **Percentage Comparisons** - trigger when HP drops below 25% of max, not just a raw number.
- **Ignore Zero** - prevent death-spam loops when a value hits exactly 0.
- **Import / Export** - back up or share your entire trigger and condition setup as JSON.
- **System Agnostic** - works with any Foundry game system.

---

## Installation

1. Download `ld-triggerz.zip` from the latest release.
2. In Foundry VTT, go to **Add-on Modules → Install Module**.
3. Paste the manifest URL or upload the zip directly.
4. Enable **LD Triggerz** in your world's **Module Management** settings.
5. Reload when prompted.

Manifest: `https://github.com/lisasdungeon/ld-triggerz/releases/latest/download/module.json`

---

## Opening the GM Hub

Everything runs through the GM Hub. You have two ways to open it:

- **Scene Control Button** - click the bolt icon in the left scene controls toolbar (labeled **Open LD Triggerz**). If you don't see it, make sure the scene control is enabled in Configure Settings.
- **Configure Settings** - open **Configure Settings**, find the **LD Triggerz** section, and click **Open GM Hub**.

The hub header shows a live count of your saved triggers, saved conditions, and currently selected tokens.

---

## Quick Start

### 1. Build a Condition

A condition is what gets applied to an actor. It can be a native Foundry status effect, a CSB status, or a fully custom homebrew condition.

1. Open the **GM Hub**.
2. In the **Condition Builder** (left side), pick a status from **Foundry/CSB Status** or leave it on **Custom status**.
3. Enter a **Condition ID** (lowercase with hyphens, e.g. `bloodied`) and a **Condition Name** (e.g. `Bloodied`).
4. Set an **Icon Path** if you want a specific icon. Default is `icons/svg/aura.svg`.
5. Add a **Description** if it helps you remember what the condition does.
6. Expand **Advanced Effect Changes** if you want the condition to modify actor data through ActiveEffects.
7. Click **Save Condition**.

### 2. Build a Trigger

A trigger watches a data path and fires when the comparison matches.

1. In the **Trigger Builder** (right side), enter a **Trigger Name** (e.g. `HP Half Check`).
2. Pick an **Actor Path** from the dropdown or enter a **Custom Path** (e.g. `system.hp.value`).
3. Choose an **Operator** (Equals, Less than, Greater than, etc.).
4. Enter a **Value** to compare against. This can be:
   - A raw number (`10`)
   - A percentage (`50%`)
   - Another actor data path (`system.hp.max`)
5. Set a **Compare Path** if you are using a percentage value.
6. Choose the **Scope** (All actors, PC only, NPC only).
7. Tick **Ignore Zero** if you want the trigger to skip when the watched value is exactly 0.
8. Choose an **Action**:
   - **None** - no direct action; use this for linked condition workflows.
   - **Apply condition** - applies a saved condition to the actor.
   - **Remove condition** - removes a saved condition from the actor.
   - **Toggle condition** - toggles a saved condition on the actor.
   - **Run macro** - runs a Foundry macro by ID.
9. Click **Save Trigger**.

### 3. Link a Condition to Triggers

1. Edit a saved condition.
2. In the **Apply Trigger** dropdown, select the trigger that should apply the condition.
3. In the **Remove Trigger** dropdown, select the trigger that should remove it.
4. Save the condition.

Now the full lifecycle runs automatically.

---

## Selected Tokens

The top-left panel of the GM Hub shows your currently selected tokens. Choose a condition from the dropdown (or type a custom condition ID), then click:

- **Assign** - tracks the condition on the actor without creating an effect.
- **Unassign** - removes that tracking.
- **Apply** - applies the condition as an effect.
- **Remove** - removes the condition effect.
- **Toggle** - flips the condition state.

---

## Import / Export

Your triggers and conditions are saved as Foundry world settings. To back them up or share them:

1. Open the **Advanced Import / Export** section at the bottom of the GM Hub.
2. Click **Export** to copy the JSON to your clipboard.
3. Click **Import** to load JSON from the textarea.

---

## CSB formulas

For Custom System Builder ActiveEffect keys, Add/Multiply values, and percent-of-stat buffs, see:

**[CSB Effect Changes how-to](docs/CSB-Effect-Changes.md)**

## Compatibility

- Foundry VTT v13 and v14
- Any game system
- No dependencies

---

## Support

- **GitHub**: https://github.com/lisasdungeon/ld-triggerz
- **Patreon**: https://patreon.com/LisasDungeon
- **Discord**: MystryssLysa
- **Email**: Lisasdungeon@gmail.com

---

## License

Lisa's Dungeon Proprietary License. All rights reserved.

---

## Development

```bash
npm install
npm run check
```

- `npm run syntax` - syntax checks all JavaScript.
- `npm run validate` - validates the manifest, templates, styles, and localization.
- `npm test` - runs the test suite with Node's built-in test runner.
- `npm run test:coverage` - runs the test suite with coverage gates (requires Node 20+).

To build a release zip:

```bash
./scripts/build-release.sh
```

The zip is written to `../../zips/ld-triggerz-<version>.zip`.

To regenerate PDF collateral after editing the script content:

```bash
python3 -m venv .pdf-venv
.pdf-venv/bin/pip install reportlab
.pdf-venv/bin/python scripts/generate-pdfs.py
rm -rf .pdf-venv
```
