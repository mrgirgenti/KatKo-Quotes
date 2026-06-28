/**
 * Canonical fee rate constants for Katalyst Ko quoting.
 *
 * SINGLE SOURCE OF TRUTH — never hardcode these values elsewhere.
 * All fee calculations, display labels, and toggle descriptions
 * must import from this file so a rate change touches one place.
 */

/** Online payment processing — percentage component (2.9%) */
export const ONLINE_FEE_PCT = 0.029;
/** Online payment processing — flat per-transaction component ($0.60) */
export const ONLINE_FEE_FLAT = 0.60;

/** In-person card processing fee (3.75%) */
export const CARD_FEE_PCT = 0.0375;

/** Sales tax rate — Mesa, AZ (8.3%) */
export const SALES_TAX_PCT = 0.083;

// ── Display strings ───────────────────────────────────────────────────────────
// Derived from the canonical numeric values above so labels never drift
// from the actual math.

/** "2.9% + $0.60" */
export const ONLINE_FEE_LABEL = `${(ONLINE_FEE_PCT * 100).toFixed(1)}% + $${ONLINE_FEE_FLAT.toFixed(2)}`;

/** "3.75%" */
export const CARD_FEE_LABEL = `${(CARD_FEE_PCT * 100).toFixed(2)}%`;

/** "8.3%" */
export const SALES_TAX_LABEL = `${(SALES_TAX_PCT * 100).toFixed(1)}%`;
