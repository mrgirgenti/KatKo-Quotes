---
name: POS / cents decimal input handling
description: How to build banking-style (cents-accumulation) numeric inputs in RN web without the backspace/cursor corruption bug.
---

# POS / banking-style decimal inputs (RN web)

`utils/posDecimalInput.ts` has TWO formatter families — pick deliberately:
- `formatPosDecimal`/`parsePosDecimal`: whole-number for 1–2 digits ("25"→"25.00"), cents for 3+ ("234"→"2.34"). Used by `CurrencyInput.tsx`. **Inconsistent** — the 2→3 digit jump (e.g. 45.00 → 4.53) feels "funky".
- `formatCents`/`parseCents`: true cash-register fill-from-right ("5"→0.05, "53"→0.53, "534"→5.34). Used ONLY by the DTF calculator's RATE PER INCH field in `LineItemCard.tsx` (rates are sub-dollar, e.g. 0.03).

**DTF WIDTH/HEIGHT do NOT use cents.** Per merchant request they are whole-number-first decimal entry: a typed "12" means 12.00 inches (NOT 0.12); quarter-inch values are typed with a dot ("12.25"). Implemented by reusing the file's existing `formatDecimalInput` (onChangeText), `parseNumber` (math), plus local `normalizeDim` (blur → trims to numeric string) and `dimFieldVal` (raw while focused, `.toFixed(2)` when blurred). **Why:** apparel dimensions are mostly whole/quarter inches, so cents fill-from-right felt wrong. Don't "unify" rate and dimension inputs onto one formatter — they are deliberately different modes.

**The bug to never reintroduce:** deriving the raw accumulator by stripping the
*formatted display string* (`text.replace(/\D/g,'')`) corrupts on backspace.
Formatting injects a leading zero ("0.40"), and on backspace "0.4" strips to
"04" which a whole-number formatter reparses as 4 → "4.00". User sees "won't
delete / keeps adding to the previous number."

**The fix / rule:** make the edit handler stateless and canonical —
`parseInt(text.replace(/\D/g,''), 10)` then store as a plain integer string
(collapses leading zeros). This makes append, backspace (shifts decimal right),
and select-all-then-type (starts fresh) all work regardless of cursor position.
Return `''` for NaN/0 so the field can show a blank-on-focus / "0.00" default.

**Why:** controlled value + reformat fights the web cursor; canonicalizing via
parseInt removes any dependence on cursor position or formatting artifacts.

**How to apply:** for any new cents/currency entry box, store the integer-cents
accumulator, display with a *consistent* cents formatter, and never re-strip the
formatted string to rebuild raw. Blank-on-focus needs a focused-field state flag
(value = focused && raw==='' ? '' : format(raw)).
