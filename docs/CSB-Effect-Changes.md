# CSB Effect Changes with LD Triggerz

How to make Condition Builder ActiveEffect changes work with Custom System Builder (CSB).

## Quick rules

1. **Attribute Key** in LD Triggerz: `system.props.<ComponentKey>`  
   Example: `system.props.DEF`
2. **Inside formulas**, use the bare component key, not the Foundry path:  
   Use `ATK_calc` - not `system.props.ATK_calc`
3. Best practice: wrap formulas in `${ ... }$` (also accepted without wrappers for Add/Multiply values).
4. **The prop you modify must be a CSB Label (with a Key)** or another computable field.  
   CSB applies ActiveEffects during sheet computation. **Number fields are not updated by ActiveEffects.**  
   Number fields are fine as *sources* (for example `ATK_calc` can be a Number or Label).
5. After changing a condition, **re-save** it, remove the status/effect, fix any stuck sheet value, then re-apply.

## Modes (what to pick in LD Triggerz)

| Goal | Mode | Value you type | What LD Triggerz stores |
|------|------|----------------|-------------------------|
| Subtract a flat amount | Add | `-0.1` | `-0.1` (Mode Add) |
| Add a flat amount | Add | `5` | `5` (Mode Add) |
| Add % of another prop | Add | `${ ATK_calc * 0.08 }$` | `${ ATK_calc * 0.08 }$` (Mode Add) |
| Multiply | Multiply | `1.5` | `1.5` (Mode Multiply) |
| Replace entirely | Override | `10` or `${ ATK_calc }$` | left as Override / Custom as typed |
| Full replace formula | Custom | `${ round(ATK_calc * 0.08) }$` | stored as-is (replaces the prop) |

Why this works: Foundry Add normally concatenates CSB string props (`"12" + "8"` → `"128"`). LD Triggerz keeps Mode Add/Multiply and forces numeric math when those changes hit `system.props.*`.

Avoid Custom formulas like `${ DEF + (...) }$` or `${ current + (...) }$` for Add-style buffs. Prefer Mode **Add** with only the bonus expression.

## Your case: buff DEF by 8% of ATK_calc

### Sheet setup (required)

- `DEF` = **Label** with Key `DEF` (Text can be a number like `10`, or a formula)
- `ATK_calc` = Label or Number with Key `ATK_calc` (used as the source)

If `DEF` is a Number field, the effect will look like it "does nothing." Change `DEF` to a Label (or point the effect at a Label that represents defense).

### Recommended (Condition Builder)

- **Key:** `system.props.DEF`
- **Mode:** Add
- **Value:** `${ ATK_calc * 0.08 }$`  
  (or `ATK_calc * 0.08` - same meaning for Add)

LD Triggerz keeps Mode **Add** and stores the bonus expression:

```text
Mode: Add
Value: ${ ATK_calc * 0.08 }$
```

At apply time that becomes numeric `DEF + (ATK_calc * 0.08)`.

### With rounding

Use Mode **Add** with:

```text
${ round(ATK_calc * 0.08) }$
```

### What does not work

```text
${ (round((system.props.ATK_calc * 0.08)*1)/1) }$
```

Problems with that formula:

1. Inside `${ }$`, CSB wants `ATK_calc`, not `system.props.ATK_calc`.
2. As Custom/Override it **replaces** DEF with 8% of ATK. It does not add onto current DEF.
3. `*1)/1` does nothing useful.
4. If `DEF` is a Number field, CSB will not apply the effect at all.

Also avoid Custom formulas like:

```text
${ DEF + (ATK_calc * 0.08) }$
${ current + (ATK_calc * 0.08) }$
```

Those look right, but CSB precompute / Custom evaluation often collapses them to the wrong value (`0 + bonus`, or `ERROR` concatenated onto the label).

## Formula cheat sheet

Assume keys `DEF` and `ATK_calc` exist on the actor.

| Intent | In LD Triggerz |
|--------|----------------|
| DEF + 8% of ATK | Mode Add, value `${ ATK_calc * 0.08 }$` |
| DEF + rounded 8% of ATK | Mode Add, value `${ round(ATK_calc * 0.08) }$` |
| DEF becomes exactly 8% of ATK | Mode Override/Custom, value `${ ATK_calc * 0.08 }$` |
| DEF + flat 5 | Mode Add, value `5` |
| ETO_check - 0.1 | Mode Add, value `-0.1` |
| Half DEF | Mode Multiply, value `0.5` |

## Keys vs paths

| Where | Write |
|-------|--------|
| LD Triggerz Key field | `system.props.DEF` |
| CSB formula body | `DEF`, `ATK_calc` |
| Referring to the target entity from an item effect | `target.DEF` (CSB `target.` prefix) |

## Status-linked conditions

1. Pick the Foundry/CSB status (or Custom).
2. Set Condition ID / Name.
3. Add Advanced Effect Changes.
4. Save the condition.
5. Apply via LD Triggerz **Apply**, or toggle the matching status on the token (LD Triggerz syncs saved changes onto that effect).

If a value looks stuck (for example `1-0.1`, only the bonus, or `ERROR12` from an older build):

1. Remove the status/effect.
2. Set the prop back to its base value.
3. Update LD Triggerz, re-save the condition, re-apply.

## Checklist when "it did nothing"

- [ ] Condition was saved after editing changes
- [ ] Key is `system.props.<exact Component Key>` (spelling/case match the sheet)
- [ ] Formula uses bare keys inside `${ }$`
- [ ] Mode matches intent (Add to buff, Override to replace)
- [ ] Add value is only the bonus (`ATK_calc * 0.08`), not `DEF + ...` / `current + ...`
- [ ] Source props (`ATK_calc`) actually have values on the actor
- [ ] Effect/status is active on the token/actor
- [ ] Sheet refreshed after apply
