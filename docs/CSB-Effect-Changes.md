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
| Subtract a flat amount | Add | `-0.1` | `${ current + (-0.1) }$` |
| Add a flat amount | Add | `5` | `${ current + (5) }$` |
| Add % of another prop | Add | `${ ATK_calc * 0.08 }$` | `${ current + (ATK_calc * 0.08) }$` |
| Multiply | Multiply | `1.5` | `${ current * (1.5) }$` |
| Replace entirely | Override | `10` or `${ ATK_calc }$` | left as Override / Custom as typed |
| Full custom expression | Custom | `${ current + round(ATK_calc * 0.08) }$` | stored as-is |

Why Add becomes Custom: Foundry Add concatenates CSB string props (`"10" + "5"` → `"105"`). LD Triggerz rewrites Add/Multiply into CSB Custom formulas using CSB's `current` token (the live value of the modified prop) so mathjs does real numeric math.

Do not write `${ DEF + (...) }$` yourself for Add-style buffs. During CSB precompute, `DEF` is often still `0`, so that formula collapses to just the bonus. Use `current` (or Mode Add and let LD Triggerz write it).

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

LD Triggerz turns that into:

```text
${ current + (ATK_calc * 0.08) }$
```

### Sure-fire Custom mode

If Add still misbehaves, use **Custom** and paste the full formula yourself:

```text
${ current + (ATK_calc * 0.08) }$
```

### With rounding

```text
${ current + round(ATK_calc * 0.08) }$
```

### What does not work

```text
${ (round((system.props.ATK_calc * 0.08)*1)/1) }$
```

Problems with that formula:

1. Inside `${ }$`, CSB wants `ATK_calc`, not `system.props.ATK_calc`.
2. It **replaces** DEF with 8% of ATK. It does not add onto current DEF.
3. `*1)/1` does nothing useful.
4. If used as Override/Custom alone, DEF becomes only the bonus, not `current + bonus`.
5. If `DEF` is a Number field, CSB will not apply the effect at all.

Also avoid:

```text
${ DEF + (ATK_calc * 0.08) }$
```

That looks right, but CSB precomputes effect formulas before `DEF` has its real base value, so `DEF` is often `0` and you only get the bonus.

## Formula cheat sheet

Assume keys `DEF` and `ATK_calc` exist on the actor.

| Intent | Formula |
|--------|---------|
| DEF + 8% of ATK | `${ current + (ATK_calc * 0.08) }$` |
| DEF + rounded 8% of ATK | `${ current + round(ATK_calc * 0.08) }$` |
| DEF becomes exactly 8% of ATK | `${ ATK_calc * 0.08 }$` (Override/Custom) |
| DEF + flat 5 | `${ current + 5 }$` or Add value `5` |
| ETO_check - 0.1 | `${ current + (-0.1) }$` or Add value `-0.1` |
| Half DEF | Multiply value `0.5` → `${ current * (0.5) }$` |

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

If a value looks stuck (for example `1-0.1` from an older build):

1. Remove the status/effect.
2. Set the prop back to its base value.
3. Update LD Triggerz, re-save the condition, re-apply.

## Checklist when "it did nothing"

- [ ] Condition was saved after editing changes
- [ ] Key is `system.props.<exact Component Key>` (spelling/case match the sheet)
- [ ] Formula uses bare keys inside `${ }$`
- [ ] Mode matches intent (Add to buff, Override to replace)
- [ ] Add/Multiply formulas use `current`, not the prop key itself (or let Mode Add write it)
- [ ] Source props (`ATK_calc`) actually have values on the actor
- [ ] Effect/status is active on the token/actor
- [ ] Sheet refreshed after apply
