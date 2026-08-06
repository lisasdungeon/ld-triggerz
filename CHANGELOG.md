# Changelog

## Unreleased

- Compliance pass: sole author Lisa's Dungeon with Discord MystryssLysa / email Lisasdungeon@gmail.com / Patreon LisasDungeon.
- Removed generative AI declaration file and README section (no AI references in the codebase).


## 1.0.5 - 2026-07-29

- Fixed the "Run macro" trigger action: it was fully wired through the GM Hub UI but silently did nothing, since the trigger engine's macro runner was never connected. It now resolves and executes the target macro, and reports a clear error (console + GM notification) if the macro id doesn't resolve.
- Fixed actor/token update processing so a failure is now surfaced (console + GM notification) instead of disappearing as a silent unhandled rejection.
- Fixed a potential crash if the `ready` hook ever fired before `init`.
- Fixed `npm run check`: the `syntax` and `validate` scripts pointed at files that didn't exist, so the pipeline failed immediately. Both scripts now exist and run for real.
- Release zips no longer bundle the promotional PDFs (how-to guide, Patreon post, promo, Reddit post, voiceover script) — those are marketing collateral, not module content.
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
