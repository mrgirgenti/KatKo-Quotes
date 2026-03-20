# Katalyst Ko Quote Tracker 5000

A React Native / Expo app for tracking sales quotes, built for Katalyst Ko custom apparel print shop.

## Features
- Create and manage sales quotes with line items
- Quote history and sales tracking
- Reports generation (PDF, CSV, Google Sheets export)
- User profiles with avatar support

## Tech Stack
- **Framework**: React Native with Expo (~54.0.27)
- **Routing**: Expo Router (file-based routing)
- **Package Manager**: Bun
- **State Management**: React Context (QuotesContext, UserContext), Zustand
- **Data Fetching**: TanStack React Query v5
- **UI**: React Native StyleSheet, lucide-react-native, expo-linear-gradient

## Project Structure
- `app/` - Expo Router pages (file-based routing)
  - `(tabs)/` - Main tab screens (New Quote, History, Sales)
  - `quote/` - Quote detail, edit, and sales tracking screens
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

## Known Patches
- `node_modules/metro-file-map/src/watchers/FallbackWatcher.js`: ENOSPC/EINVAL treated as ignorable (prevents Metro crash on Replit)
- `stubs/react-native-reanimated.js`: Comprehensive stub; wired via `metro.config.js` `extraNodeModules`

## Deployment
Configured as a static site deployment using `expo export --platform web` to build the `dist/` directory.
