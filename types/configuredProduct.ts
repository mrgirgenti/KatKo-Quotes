import type { SizeQuantities } from './quote';

/**
 * ConfiguredColorVariant — one color + size-run within a ConfiguredProduct.
 * Replaces the old GarmentVariant's per-row data.
 */
export interface ConfiguredColorVariant {
  color: string;
  colorHex?: string;
  sizes: SizeQuantities;
  colorId?: string;
}

/**
 * ArtworkLayer — a single artwork element placed on the garment.
 * Mirrors what the Mockup Designer currently tracks via mockupUri.
 */
export interface ArtworkLayer {
  id: string;
  type: 'image' | 'text';
  uri?: string;
  text?: string;
  printLocation: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  locked?: boolean;
}

/**
 * PrintLocationTemplate — optional constraints per placement.
 */
export interface PrintLocationTemplate {
  location: string;
  defaultWidth?: number;
  defaultHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * ConfiguredProduct — single source of truth for product state
 * within a Quote Line Item.
 *
 * ARCHITECTURE RULE:
 *   - ONE ConfiguredProduct per LineItem.
 *   - Multiple colors expressed through colorVariants[].
 *   - NEVER store quote-specific state on the Products catalog.
 *   - Products catalog = reference data only.
 *
 * PRODUCT MODEL LAW (per replit.md):
 *   - Quoting is never gated on the catalog. productSource='manual'
 *     is always valid. productId is an optional enhancement link.
 */
export interface ConfiguredProduct {
  // ── Product identity ─────────────────────────────────────────
  /** e.g. "T-Shirts", "Hats", "Polos" — from Products.category */
  category?: string;
  /** Canonical alias used by Mockup Designer (same as category) */
  productType?: string;
  /** e.g. "NL6210" */
  styleNumber?: string;
  /** e.g. "Next Level CVC Crew" */
  styleName?: string;
  /** e.g. "Next Level" */
  brand?: string;
  /** Optional link to the curated catalog Product row */
  productId?: string;
  /** How the product was entered */
  productSource: 'catalog' | 'manual';
  /** Raw product label string (legacy: "NL6210 — Next Level CVC Crew") */
  productLabel?: string;
  /** URL to a catalog product image */
  productImageUrl?: string;

  // ── Vendor / sourcing ─────────────────────────────────────────
  /** e.g. "S&S Activewear" */
  vendorName?: string;
  /** Vendor-specific item SKU */
  vendorSku?: string;

  // ── Decoration ────────────────────────────────────────────────
  /** Maps to LineItem.serviceStyle: "Screen Printing", "Embroidery", etc. */
  decorationMethod: string;

  // ── Color + size variants ─────────────────────────────────────
  /** One entry per color/size-run. Replaces garmentVariants[]. */
  colorVariants: ConfiguredColorVariant[];

  // ── Print locations ───────────────────────────────────────────
  /** Ordered list, e.g. ["Left Chest", "Full Back"] */
  printLocations: string[];
  locationDetails?: string;

  // ── Artwork / mockup state ────────────────────────────────────
  /** Data URI or URL of the rendered mockup (legacy compat) */
  mockupUri?: string;
  /** Structured artwork layer data for Mockup Designer v2 */
  artworkLayers?: ArtworkLayer[];
  /** Per-location template constraints */
  templateSettings?: Record<string, PrintLocationTemplate>;

  // ── Pricing snapshot ──────────────────────────────────────────
  productCostEach: number;
  serviceCostEach: number;
  serviceFeeEach: number;
  markupEach: number;
}
