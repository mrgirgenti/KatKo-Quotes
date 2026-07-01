# UI Design System

## Purpose

This document is the single source of truth for visual design decisions in the **Katalyst Ko Quote Tracker 5000**. It describes the color palette, typography scale, spacing system, component patterns, and interaction rules that define the application's look and feel.

All new UI must be built from these tokens. Do not introduce new hex values, new border radii, or new spacing values without updating this document. Import tokens from `constants/colors.ts` and `constants/designSystem.ts` — never hardcode values in a component StyleSheet.

---

## Color Palette

Source of truth: `constants/colors.ts` (export `Colors.light.*`)

### Brand
| Token | Value | Usage |
|---|---|---|
| `Colors.light.tint` | `#FF5A00` | Primary brand orange — buttons, active states, key highlights |
| `Colors.light.accent` | `#FF5A00` | Alias for `tint` |
| `Colors.light.highlight` | `#FF5A00` | Alias for `tint` |

### Text
| Token | Value | Usage |
|---|---|---|
| `Colors.light.text` | `#000000` | Primary body text, labels, headings |
| `Colors.light.textSecondary` | `#4a4a4a` | Helper text, metadata, secondary labels |

### Backgrounds
| Token | Value | Usage |
|---|---|---|
| `Colors.light.background` | `#ffffff` | Page background |
| `Colors.light.surface` | `#ffffff` | Card surfaces |
| `Colors.light.headerBg` | `#000000` | Table column headers, major section header bars |
| `Colors.light.highlightBg` | `#E5E7EB` | Subtle highlight rows (COG row, markup row, subtotal sections) |
| `Colors.light.ghostActiveBg` | `#FFF4EE` | Active ghost/pill button background (tinted orange) |

### Borders
| Token | Value | Usage |
|---|---|---|
| `Colors.light.border` | `#e0e0e0` | Standard card and input borders |
| `Colors.light.borderDark` | `#c0c0c0` | Stronger dividers, active input borders |

### Semantic / Status
| Token | Value | Usage |
|---|---|---|
| `Colors.light.success` | `#059669` | Success states, "Completed" status |
| `Colors.light.warning` | `#d97706` | Warning states, "Quoted" / pending status |
| `Colors.light.error` | `#dc2626` | Error states, danger buttons, "Cancelled" status |

### Rules
- Never use hex literals in a component `StyleSheet`. Always reference `Colors.light.*`.
- The square KO. flag icon (`assets/images/ko-logo.png`) is for auth pages only.
- The horizontal wordmark (`assets/images/ko-logo-horizontal.png` / `KO_LOGO_HORIZONTAL_URI`) is the primary brand asset for all documents and the sidebar.

---

## Typography

Source of truth: `constants/designSystem.ts` → `DS.font`

| Role | Size | Weight | Color | Transform |
|---|---|---|---|---|
| Page Title | 24 | 800 | `#000000` | — |
| Section Head | 16 | 700 | `#000000` | — |
| Card Title | 15 | 700 | `#000000` | — |
| Label (uppercase) | 11 | 700 | `#4a4a4a` | uppercase, letterSpacing: 0.5 |
| Body | 14 | 400 | `#000000` | — |
| Body Small | 13 | 400 | `#000000` | — |
| Helper Text | 12 | 400 | `#4a4a4a` | — |
| Table Header | 11 | 700 | `#FFFFFF` | uppercase, letterSpacing: 0.5 |

### Rules
- Heading hierarchy flows: Page Title → Section Head → Card Title → Label → Body.
- `fontWeight` must be a string literal in React Native (`'700'`, not `700`).
- Table column headers always render white text on a black (`#000000`) background bar.
- Status badge text is 11px, weight 600, rendered inside a pill with the appropriate status color background.

---

## Border Radius

Source of truth: `constants/designSystem.ts` → `DS.radius`

| Token | Value | Usage |
|---|---|---|
| `DS.radius.sm` | 8px | Icon buttons, small action buttons |
| `DS.radius.md` | 10px | Standard buttons, text inputs, search boxes |
| `DS.radius.lg` | 12px | Cards (standard content card) |
| `DS.radius.xl` | 14px | Larger content panels |
| `DS.radius.xxl` | 18px | Modal/dialog cards |
| `DS.radius.pill` | 20px | Status badges, segmented toggle pills |

### By component type
| Component | Radius |
|---|---|
| Standard content card | 12px (`lg`) |
| Input / TextInput | 10px (`md`) |
| Primary / Secondary button | 10px (`md`) |
| Dialog / Modal card | 18px (`xxl`) |
| Status badge / pill | 20px (`pill`) |
| Section header bar | Rounded top corners only (topLeft: 12, topRight: 12) |

---

## Header Hierarchy

### Level 1 — Major Section Header (Black Bar)
Used for the top of a major content section: table headers, primary module headers.
- Background: `#000000`
- Text: `#FFFFFF`, 13–14px, weight 700, uppercase, letterSpacing: 0.5
- Rounded top corners: `borderTopLeftRadius: 12, borderTopRightRadius: 12`
- Example: Table column header row, "QUOTE SUMMARY" panel header

### Level 2 — Subsection Header (Light Gray)
Used for collapsible subsections or grouping panels within a card.
- Background: `Colors.light.highlightBg` (`#E5E7EB`)
- Text: `Colors.light.text`, 13px, weight 700
- Example: "Line Item Subtotals" section title, "Client Quote Price" panel

### Level 3 — Inline Group Label (Uppercase, Secondary Color)
Used inline to label a field group without a background.
- Text: `Colors.light.textSecondary` (`#4a4a4a`), 11px, weight 700, uppercase, letterSpacing: 0.5
- Example: "SIZES", "PRINT LOCATIONS", column group labels

---

## Spacing

Source of truth: `constants/designSystem.ts` → `DS.spacing`

| Token | Value | Primary usage |
|---|---|---|
| `DS.spacing.xs` | 4px | Tight gaps between inline elements |
| `DS.spacing.sm` | 8px | Internal padding in compact components |
| `DS.spacing.md` | 12px | Standard intra-card gap, between form fields |
| `DS.spacing.lg` | 16px | Standard page horizontal padding, card padding |
| `DS.spacing.xl` | 20px | Between cards / sections |
| `DS.spacing.xxl` | 24px | Section-to-section gaps |
| `DS.spacing.section` | 32px | Major page section separators |

### Rules
- Standard page horizontal padding: 16px (`lg`)
- Standard card internal padding: 14–16px
- Gap between list items in a card: 8–12px

---

## Buttons

Source of truth: `constants/designSystem.ts` → `dsStyles.btn*`

### Primary Button
Used for the single most important action on a surface.
- Background: `#FF5A00`
- Text: `#FFFFFF`, weight 700
- Height: 40px, horizontal padding: 16px, radius: 10px

### Secondary Button
Used for secondary actions that are still clearly presented.
- Border: 1.5px `#FF5A00`
- Background: `#FFFFFF`
- Text: `#FF5A00`, weight 600
- Height: 40px, radius: 10px

### Ghost Button
Used for low-emphasis actions, filter pills, inactive toggle states.
- Border: 1px `#e0e0e0`
- Background: `#FFFFFF`
- Text: `#4a4a4a`
- **Active state:** Border `#FF5A00`, Background `#FFF4EE`, Text `#FF5A00`

### Danger Button
Used for destructive actions (delete, cancel, remove).
- Background: `#dc2626`
- Text: `#FFFFFF`, weight 700
- Same sizing as Primary

### Icon Button
Used for compact actions in table rows and toolbars.
- Background: transparent or `Colors.light.surface`
- Border: 1px `#e0e0e0`, radius: 8px (`sm`)
- Icon: 16–18px, `Colors.light.textSecondary`
- Active/danger variant: icon `Colors.light.error`

### Segmented Toggle
Used for mode selection (e.g., serviceStyle, filter tabs).
- Outer container: borderRadius 6px, border `#e0e0e0`
- Inactive segment: Background `#e0e0e0`, Text `#4a4a4a`
- Active segment: Background `#FF5A00`, Text `#FFFFFF`
- Height: 36px per segment

---

## Forms

### Text Input
- Height: 40px minimum
- Border: 1px `#e0e0e0`, focused border: `#FF5A00`
- Border radius: 10px (`md`)
- Padding: 10px horizontal
- Font: 14px, `#000000`
- Placeholder: 14px, `#4a4a4a`

### Dropdowns / Selects
- All dropdowns and floating panels **must** use `<OverlayMenu>` from `components/OverlayMenu.tsx`
- Never use `position: 'absolute'` siblings — they clip inside ScrollViews
- `<OverlayMenu>` renders via a Modal (portal) so it floats above the entire page unconditionally

### Checkboxes
- Unchecked: border `#e0e0e0`, background `#ffffff`
- Checked: background `#FF5A00`, checkmark `#ffffff`
- Size: 18×18px, radius: 4px

### Form Field Spacing
- Label above input: 4px gap
- Between fields vertically: 12px (`md`)
- Between field groups: 20px (`xl`)

### Validation
- Error text: 12px, `Colors.light.error` (`#dc2626`), appears below the input
- Error border: `Colors.light.error`
- Do not block form submission — show inline validation messages

---

## Tables

### Structure
All operational tables (Quotes/Projects, Organizations, Contacts) are full desktop-width tables rendered inside a **horizontal `ScrollView`** at every breakpoint. No column hiding, no card views on mobile. Minimum content width enforced via `minWidth` on the inner container.

### Column Header Row
- Background: `#000000`
- Text: `#FFFFFF`, 11px, weight 700, uppercase, letterSpacing: 0.5
- Height: 38–40px
- Rounded top corners: 12px
- Sort indicator: small arrow icon in `#FFFFFF`

### Data Rows
- Background: alternating `#ffffff` / `Colors.light.highlightBg`
- Border bottom: 1px `Colors.light.border`
- Height: 48px minimum
- Text: 14px, `Colors.light.text`
- Secondary text: 12px, `Colors.light.textSecondary`

### Hover / Selection
- Row hover: background `#FFF4EE` (tinted orange)
- Selected row: background `#FFF4EE`, left border 3px `#FF5A00`

### Standard Column Widths
Global defaults (desktop / tablet / desktop-wide):
| Column type | Default widths |
|---|---|
| Text (primary) | 280 / 220 / 400 |
| Text (standard) | 130 / 110 / 220 |
| Status | 120px fixed |
| Date | 110px fixed |
| Numeric | 88px fixed |

Per-table overrides:
| Table | Column | Width |
|---|---|---|
| Organizations | `org` name | 240 / 195 / 315 |
| Organizations | `bizType` | 130px fixed |
| Organizations | `phone` | 138px fixed |
| Quotes/Projects | `colProject` | 210 / 160 / 300 |
| Client Hubs | `colOrg` | flex:1, minWidth:160, maxWidth:300 |

### Row Context Menu
All row-level action menus must use `<OverlayMenu>` (see Dropdowns above). The trigger is an icon button (⋯) at the right edge of the row.

### Actions Bar (above table)
- Search input on the left (flex:1)
- Filter pills center/right
- Primary action button ("New Quote", "Add Org") rightmost
- Height: 52px, padding: 12–16px

---

## Cards

### Section Card
Standard content grouping on a detail page.
- Background: `#ffffff`
- Border: 1px `#e0e0e0`
- Border radius: 12px
- Padding: 14–16px
- Shadow: `rgba(0,0,0,0.06)`, blur 6px

### Summary Card
Used in the Quote Summary panel and portal order summaries.
- Same base as Section Card
- Header bar (Level 1) at top with title
- Internal rows use the five-bucket naming (Product / Service / Production / Other / Markup)

### Settings Card
Used in the Settings pages for individual setting groups.
- Same base as Section Card
- Sub-sections separated by a 1px `Colors.light.border` divider
- Toggle switches right-aligned

---

## Dialogs

### Modal
Full overlay modal for creation, editing, or confirmation flows.
- Overlay: `rgba(0,0,0,0.5)` background
- Card: `#ffffff`, border radius 18px (`xxl`), max-width 560px on desktop
- Header: title 17px weight 700, close icon top-right
- Footer: action buttons right-aligned (Primary + Ghost/Cancel)

### Drawer
Side panel that slides in from the right for detail views.
- Width: 480px on desktop, full width on mobile
- Overlay: same as Modal
- Close button top-right

### Confirmation Dialog
Compact dialog for destructive actions.
- Message: 14px centered
- Two buttons: Danger (confirm) left, Ghost (cancel) right
- Never auto-confirm — always require explicit user action

---

## Responsive Behavior

### Breakpoints
Source: `hooks/useBreakpoint.ts`

| Breakpoint | Width |
|---|---|
| Mobile | < 768px |
| Tablet | 768px – 1199px |
| Desktop | ≥ 1200px |

### Shell Layout
- **Desktop:** Sidebar + main content area. Sidebar: 240px fixed. Main: flex:1.
- **Mobile:** Bottom tab bar, no sidebar.
- The shell switch is gated behind a `mounted` flag to prevent SSR hydration mismatches (`useWindowDimensions` returns 0 on the server, which reads as mobile).

### Operational Tables (Quotes, Projects, Orgs, Contacts)
All breakpoints render the **same full desktop table** inside a horizontal `ScrollView` with a fixed `minWidth`. No column hiding or card layouts at any breakpoint. This is a deliberate decision: shop staff use these tables for data-dense workflows; card views lose too much context.

### Detail Pages (Quote, Org, Project)
- Desktop: Two-column layout (form left, summary/sidebar right)
- Mobile: Single-column stacked
- `PageBackHeader` component is used for the back navigation bar on all detail pages

### Portal (Customer-Facing)
- Sidebar + main content layout on desktop
- Single-column stacked on mobile
- Portal sidebar height: `height: 100vh` on the layout container (not `flex: 1`)

---

## Future Standards

The design system will evolve in these directions:

**Dark mode:** Color tokens in `constants/colors.ts` already have a `dark` object defined. The intent is full dark-mode support. Any new component should use `Colors.light.*` tokens (not hardcoded hex) so the switch to `Colors.dark.*` is a token replacement, not a rewrite.

**Accessibility:** Touch targets should be a minimum 44×44px. Color contrast should meet WCAG AA. Status information must never be conveyed by color alone (pair with a text label or icon).

**Animation:** Transitions for modal open/close and sheet slide-in should use `Animated` or `react-native-reanimated` with 200–250ms duration and an ease-out curve. No layout animations on list items (performance cost at scale).

**Component library consolidation:** Shared primitives (Button, Input, Badge, Card) should be migrated to `constants/designSystem.ts` `dsStyles` exports so all surfaces stay in sync automatically.
