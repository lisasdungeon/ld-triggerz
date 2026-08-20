# Changelog

## 1.0.14

- README version now matches the manifest

## 1.0.13 - 2026-08-13

- Fixed a startup console error (`UncomputableError: Uncomputable token "..."`) that CSB throws when an ActiveEffect's Add/Multiply value formula references a Label/formula prop (for example `ATK_calc`) that has not been computed yet. LD Triggerz now preserves that formula text through CSB's early precompute pass instead of letting CSB fail on it early.
- Removed a rethrow in the Add/Multiply delta patch that, if a formula still could not resolve, would have escaped Foundry's own `applyActiveEffect` handling and could have broken an actor's whole sheet computation. Unresolvable deltas are now logged and skipped instead, matching CSB's own non-fatal fallback behavior.

## 1.0.12 - 2026-08-13

- Fixed CSB Add/Multiply on Labels showing values like `ERROR12`. Custom `current` formulas were failing, then concatenating onto the label. LD Triggerz now keeps native Add/Multiply and forces numeric math for `system.props.*` so `12 + 8` becomes `20`, not `"128"` or `"ERROR12"`.
- Mode Add with a bonus expression such as `${ ATK_calc * 0.08 }$` now adds onto the live label value.
- Updated `docs/CSB-Effect-Changes.md` for the Add-delta approach.

## 1.0.11 - 2026-08-13

- Fixed CSB Add/Multiply buffs that only applied the bonus (for example DEF became `ATK_calc * 0.08` instead of base DEF plus that bonus). Formulas now use CSB's `current` token, and LD Triggerz preserves `current` formulas through CSB precompute so apply-time math uses the live prop value.
- Existing saved `${ DEF + (...) }$` style changes migrate to `${ current + (...) }$` on save/apply.
- Updated `docs/CSB-Effect-Changes.md` for the `current` token.

## 1.0.10 - 2026-08-13

- CSB Add/Multiply values now accept bare expressions like `ATK_calc * 0.08` (not only `${ ... }$` wrappers) and normalize them to component-key Custom formulas.
- Added `docs/CSB-Effect-Changes.md` with CSB ActiveEffect how-to notes, including that the modified prop must be a keyed Label (Number fields are not updated by CSB ActiveEffects).
- Removed the voiceover script PDF and its generator from the repository.
- Replaced em/en dashes in changelog and docs with plain ASCII hyphens.

## 1.0.9 - 2026-08-13

- Fixed CSB string concatenation on Add (`"1" + "-0.1"` becoming `"1-0.1"`): `system.props.*` Add/Multiply now normalize to Custom formulas using the component key, e.g. `${ ETO_check + (-0.1) }$`, so CSB/mathjs performs real numeric math.

## 1.0.8 - 2026-08-13

- Fixed CSB 6 ActiveEffect math: keep native Add/Multiply/Override for `system.props.*` instead of converting them to Custom `current` formulas that CSB drops during `computeEffectChanges`.
- Reverse-migrates previously saved Custom `current + ()` / `current * ()` formulas back to native Add/Multiply on save and apply.

## 1.0.7 - 2026-08-13

- Fixed status-linked conditions so Advanced Effect Changes are applied instead of being dropped by `toggleStatusEffect`.
- Syncing saved condition ActiveEffect changes when a matching Foundry/CSB status is applied from the token HUD or elsewhere.
- CSB `system.props.*` add/multiply/override values continue to normalize into custom formulas on apply and sync.

## 1.0.6

- Compliance and hardening release: sole Lisa's Dungeon authorship and contact fields (Discord MystryssLysa, email Lisasdungeon@gmail.com, Patreon LisasDungeon); lazy loading / trigger-based startup where needed; 500 LOC file cap; full source line coverage; no emoji or AI references in the shipped package.
- Compliance pass: sole author Lisa's Dungeon with Discord MystryssLysa / email Lisasdungeon@gmail.com / Patreon LisasDungeon.
- Removed non-compliant declaration file and related README section.
- Expanded automated tests to 100% line, branch, and function coverage across main.js and all src modules (GM Hub UI, item detail windows, UIManager, LDTriggerz orchestration, hooks).
- Added jsdom as a devDependency for DOM-level UI event tests.

## 1.0.5 - 2026-07-29

- Fixed the "Run macro" trigger action: it was fully wired through the GM Hub UI but silently did nothing, since the trigger engine's macro runner was never connected. It now resolves and executes the target macro, and reports a clear error (console + GM notification) if the macro id doesn't resolve.
- Fixed actor/token update processing so a failure is now surfaced (console + GM notification) instead of disappearing as a silent unhandled rejection.
- Fixed a potential crash if the `ready` hook ever fired before `init`.
- Fixed `npm run check`: the `syntax` and `validate` scripts pointed at files that didn't exist, so the pipeline failed immediately. Both scripts now exist and run for real.
- Release zips no longer bundle the promotional PDFs (how-to guide, Patreon post, promo, Reddit post) - those are marketing collateral, not module content.
- Added a real automated test suite (123 tests) covering the trigger engine, condition adapter, macro runner, debug logger, data manager, socket handler, and CSB effect-value normalization.

## 1.0.4 - 2026-07-24

- Removed the unsupported `patreon` manifest field to resolve Foundry's "unknown keys" console warning.
- Fixed the release zip packaging, which was shipping an empty `src/` directory instead of the module's actual source files.

## 1.0.3 - 2026-06-22

- Added a Configure Settings menu launcher for the LD Triggerz GM Hub.
- Added a `None` trigger action for triggers that only drive linked condition apply/remove rules.
- Fixed CSB ActiveEffect math for `system.props.*` paths by converting add, multiply, and override values into CSB custom formulas.
- Updated ActiveEffect value placeholders to show path/formula-friendly input.

## 1.0.2 - 2026-06-21

- Added condition-level Apply Trigger and Remove Trigger links so saved conditions can react to existing triggers.
- Fixed the scene-control launcher to honor the Foundry settings toggle.

## 1.0.1 - 2026-06-21

- Added trigger comparisons where the value can resolve from an actor data path.
- Fixed CSB trigger evaluation for flat Foundry update keys and numeric string comparisons.
- Fixed token HUD actor-delta updates so token bar value edits trigger the same rules as sheet edits.
- Fixed condition removal for Foundry ActiveEffect collections.
- Fixed trigger actions so saved/custom condition data is resolved before apply, remove, or toggle.
- Fixed path-value remove triggers for token delta actor data.
- Fixed path-value remove triggers when CSB computed labels only exist on live prepared actor data.
- Fixed CSB token-bar updates that arrive as system-relative actor paths such as `props.HP`.

## 1.0.0

- LD Triggerz v1 release foundation.
- Added Bible-aligned root `main.js` and `src/` architecture.
- Added trigger engine, condition adapter, GM hub shell, scene controls, socket boundary, storage, and strict validation.
