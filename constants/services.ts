// ─────────────────────────────────────────────────────────────────────────────
// MASTER SERVICE CONFIGURATION
// Single source of truth for service ordering and metadata.
// Import from this module in Dashboard, Client Legacy, Reporting, Filters, etc.
// ─────────────────────────────────────────────────────────────────────────────

// Canonical ServiceStyle order (matches types/quote.ts ServiceStyle union).
// The Dashboard, Quote selector, and Project filters all derive order from here.
export const SERVICE_ORDER = [
  'Direct to Film',
  'Screen Printing',
  'Embroidery',
  'Promotional',
  'DTF Transfers',
  'Design Work',
] as const;

export type ServiceOrderKey = (typeof SERVICE_ORDER)[number];

// Normalized display names used by Client Legacy.
// "Screen Printing" is stored as-is in quotes but displayed as "Screen Print" in Legacy KPIs.
export const LEGACY_SERVICE_ORDER = [
  'Direct to Film',
  'Screen Print',
  'Embroidery',
  'Promotional',
  'DTF Transfers',
  'Design Work',
] as const;

export type LegacyServiceKey = (typeof LEGACY_SERVICE_ORDER)[number];

// Client Legacy dot/accent colors (keyed by legacy display name).
export const LEGACY_SERVICE_COLORS: Record<string, string> = {
  'Direct to Film': '#FF5A00',
  'Screen Print':   '#1C1C1E',
  'Embroidery':     '#1E3A8A',
  'Promotional':    '#0E7490',
  'DTF Transfers':  '#DC2626',
  'Design Work':    '#D97706',
};

// Fallback colors for any additional service types discovered in project history.
export const LEGACY_FALLBACK_COLORS = ['#7C3AED', '#0891B2', '#CA8A04', '#2563EB', '#DB2777'];

// Whether PCS (piece count) is meaningful for a service.
// Design Work is billed per project/deliverable, not per piece.
export const SERVICE_HAS_PCS: Record<string, boolean> = {
  'Direct to Film': true,
  'Screen Print':   true,
  'Embroidery':     true,
  'Promotional':    true,
  'DTF Transfers':  true,
  'Design Work':    false,
};
