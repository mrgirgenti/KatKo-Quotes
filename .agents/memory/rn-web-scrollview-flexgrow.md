---
name: RN-web ScrollView eats flex-row width (flexGrow:1 base)
description: Why a fixed-width ScrollView column in a flexDirection row still grows to ~half the row, and how to pin it.
---

# RN-web ScrollView grows inside a flex row

A `ScrollView` placed as a column inside a `flexDirection: 'row'` container will grow far beyond its set `width`/`flexBasis`, even with `flexShrink: 0`.

**Why:** react-native-web's `ScrollView` ships `flexGrow: 1` in its internal base style. Your style prop merges on top, so `flexShrink:0` overrides the base, but if you never set `flexGrow`, the base `flexGrow:1` survives. The panel then takes its basis PLUS its share of the leftover space. With a sibling `flex:1` (flexBasis 0%), a `width:240` left ScrollView in a ~1280 row renders at 240 + (1280-240)/2 ≈ 760px (~58%), not 240px — looks like a near-center divider.

**How to apply:** To pin a ScrollView column to a fixed/proportional width in a flex row, explicitly set `flexGrow: 0` (alongside `flexShrink: 0` and `width` or `flexBasis`). A plain `View` does not have this problem; only ScrollView (and other RN scroll containers) carry the flexGrow:1 base. Symptom to watch for: a column that should be narrow renders ~50%+ wide despite an explicit width.
