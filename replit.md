# Katalyst Ko Quote Tracker 5000

A React Native / Expo app for tracking sales quotes, built for Katalyst Ko custom apparel print shop.

## Features
- Create and manage sales quotes with line items
- Unified Projects tab (replaces separate Quote History + Sales tabs)
- Project lifecycle: Draft → Quoted → Active → Completed (auto-Expired after 30 days)
- Per-line-item completion tracking in Production View
- Rich filter bar: status pills, search, total range, sort
- Client management with profile pages (linked quotes, stats, edit, delete)
- Reports generation (PDF, CSV, Google Sheets export)
- User profiles with avatar support

## Project Status Flow
- `draft` — quote being built (New Quote tab only)
- `quoted` — submitted to client (appears in Projects tab)
- `active` — client accepted, in production
- `completed` — all line items marked done in Production View
- `expired` — auto-computed: quoted + orderDate > 30 days ago (no action needed)

## Tech Stack
- **Framework**: React Native with Expo (~54.0.27)
- **Routing**: Expo Router (file-based routing)
- **Package Manager**: Bun
- **State Management**: React Context (QuotesContext, UserContext), Zustand
- **Data Fetching**: TanStack React Query v5
- **UI**: React Native StyleSheet, lucide-react-native, expo-linear-gradient

## Project Structure
- `app/` - Expo Router pages (file-based routing)
  - `(tabs)/` - Main tab screens (New Quote, History, Sales, Clients)
  - `quote/` - Quote detail, edit, and sales tracking screens
  - `clients/[id].tsx` - Client profile page (info panel + linked quotes)
  - `profile.tsx`, `reports.tsx`, `modal.tsx`
- `components/` - Reusable UI components
- `contexts/` - React Context providers (QuotesContext, UserContext)
- `constants/` - Colors and other constants
- `utils/` - PDF generator, CSV export, Google Sheets export
- `types/` - TypeScript type definitions

## Running the App
The app runs via the "Start application" workflow on port 5000 using:
```
PORT=5000 bun run node_modules/.bin/expo start --web --port 5000
```

## Key Configuration Files
- `app.json` - Expo configuration
- `metro.config.js` - Metro bundler config (bun cache excluded from watching)
- `tsconfig.json` - TypeScript configuration

## Responsive System
The app uses a width-based breakpoint system (`hooks/useBreakpoint.ts`) for responsive layouts:
- **Mobile** (< 768px): Bottom tab bar navigation, single-column layout, 16px horizontal padding
- **Tablet** (768–1023px): Collapsed sidebar (64px icon-only), single-column layout
- **Desktop** (≥ 1024px): Full expanded sidebar (240px), two-column layout with sticky pricing panel

Breakpoints are detected via `useWindowDimensions` so they respond to live browser resizing. The navigation switches between `Tabs` (bottom bar, mobile) and `Sidebar + Slot` (web, tablet/desktop) in `app/(tabs)/_layout.tsx`.

## UI Conventions
- **Brand colors**: Primary/tint `#FF5A00`, sidebar/header `#000000`
- **Line Item Card header**: `#000000` (black) with white text
- **Quote Details line item header**: `#111111` (black), collapsible, shows design name + service·applicator + qty pcs + chevron
- **ToggleButton**: Selected state (Yes or No) is always orange (`#FF5A00`); unselected is grey
- **ComboBox popup**: `maxWidth: 340`, compact paddings/fonts, capped list height `240`
- **Projects table header**: `#111111` black with white text; columns: Status, Date, Client, Project, Applicator(s), Service(s), Total, Markup, Actions
- **Clients table header**: `#111111` black with white text; columns: Avatar, Name, Organization, Email, Phone, Status, Actions

## Quote Details Page
- **Action bar** (quoted status): ⋮ menu | Mark as Active | Start Production (Flame icon)
- **Action bar** (active/completed): ⋮ menu | Track Costs | Start Production (Flame icon)
- **Menu items**: Edit Quote | Revert to Quoted (active only) | Export to Sheets (active only) | Export PDF | Print | Delete
- **Mark as Active**: stays on page, no navigation (toast confirmation only)
- **Revert to Quoted**: stays on page, no navigation (toast + Alert confirmation)
- **Desktop layout**: two-column (left: Order Info + Line Items, right: Pricing Summary + Sales Tracking)
- **PDF/Print**: Opens new browser window with HTML, triggers print dialog after 800ms

## PDF/Print (web)
Both `generateAndSharePDF` and `printQuote` on web:
1. Generate HTML string from quote data
2. Open new window (`window.open('', '_blank')`)
3. Write HTML to new window
4. Call `window.print()` after 800ms delay

## LineItem Card Layout (field order)
1. Design Name
2. Service Style (SegmentedControl)
3. Service Applicator + Product Source (side-by-side row)
4. Location #1 + Location #2 (side-by-side row)
5. `+ Add Location #3 / #4` (expandable — shows Location 3 + 4 row inline)
6. Project Notes
7. **Garment & Sizes** section — multi-color variant table (up to 10 rows)
   - Each row: Style/Product | Color | XS | S | M | L | XL | 2XL | 3XL | 4XL | Qty | [X]
   - `GarmentVariant = { product, color, sizes: SizeQuantities }`
   - Stored as `item.garmentVariants?: GarmentVariant[]`
   - All variant sizes merged into `item.sizes` for downstream calculations
8. Embroidery Calculator (if Embroidery style)
9. DTF Calculator (if Direct to Film style), inside costs section
10. Costs Per Piece (Product / Service / Fees / Markup)
11. Line Item Subtotal table

## Order Information Form
- Tablet/Desktop: Person/Organization | Project Name | Invoice Number on same row (3 columns)
- Mobile: stacked fields

## Known Patches
- `node_modules/metro-file-map/src/watchers/FallbackWatcher.js`: ENOSPC/EINVAL treated as ignorable (prevents Metro crash on Replit)
- `stubs/react-native-reanimated.js`: Comprehensive stub; wired via `metro.config.js` `extraNodeModules`

## Deployment
Configured as a static site deployment using `expo export --platform web` to build the `dist/` directory.
