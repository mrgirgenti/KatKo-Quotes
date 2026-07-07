export const CANVAS_W = 500;
export const CANVAS_H = 600;

/** Canvas units per real-world inch. Zones are authored in this 500×600 space. */
export const UNITS_PER_INCH = 25;

export type GarmentType = 'tshirt' | 'polo' | 'crewneck' | 'hoodie' | 'longsleeve' | 'hat';
export type GarmentView = 'front' | 'back';
export type PrintLocation =
  | 'Left Chest'
  | 'Right Chest'
  | 'Pocket (literal)'
  | 'Center Chest'
  | 'Full Front'
  | 'Oversize Front'
  | 'Full Back'
  | 'Collar/Upper Back'
  | 'Oversize Back'
  | 'Left Sleeve'
  | 'Right Sleeve'
  | 'Neck Tag';

/** Decoration / print methods a location template can recommend. */
export type DecorationMethod =
  | 'Screen Print'
  | 'Embroidery'
  | 'DTG'
  | 'Heat Transfer'
  | 'Vinyl'
  | 'Sublimation';

export const DECORATION_METHODS: DecorationMethod[] = [
  'Screen Print',
  'Embroidery',
  'DTG',
  'Heat Transfer',
  'Vinyl',
  'Sublimation',
];

/** Where artwork anchors inside a zone's safe area before any manual offset. */
export type SnapPosition =
  | 'center'
  | 'top-center'
  | 'bottom-center'
  | 'left'
  | 'right';

export const SNAP_POSITIONS: { value: SnapPosition; label: string }[] = [
  { value: 'center', label: 'Center' },
  { value: 'top-center', label: 'Top' },
  { value: 'bottom-center', label: 'Bottom' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

/**
 * An intelligent preset for a single print location. This is a client-side
 * adapter shape — NOT a parallel persisted store. Values are derived from the
 * static garment zone and can be overridden per-zone (future per-garment
 * presets) or by catalog DB effective-placements (inch sizing only).
 */
export interface PrintTemplate {
  /** Default artwork bounding box (inches) the artwork is fitted into. */
  defaultWidthIn: number;
  defaultHeightIn: number;
  /** Hard maximum the artwork may be scaled to (inches). */
  maxWidthIn: number;
  maxHeightIn: number;
  /** Margin kept clear inside the zone on every side (inches). */
  safeAreaIn: number;
  /** Recommended decoration method for this location. */
  decorationMethod: DecorationMethod;
  /** Default anchor inside the safe area. */
  snap: SnapPosition;
  /** Default manual offset from the snap anchor (inches). */
  defaultOffsetXIn: number;
  defaultOffsetYIn: number;
}

export interface ZoneDefinition {
  id: PrintLocation;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  view: GarmentView;
  /** Optional explicit template override (future per-garment presets). */
  template?: Partial<PrintTemplate>;
}

export interface GarmentDefinition {
  label: string;
  frontPath: string;
  backPath: string;
  frontDetails?: string[];
  backDetails?: string[];
  defaultColor: string;
  zones: ZoneDefinition[];
}

const BODY_FRONT =
  'M 80,55 L 5,100 L 5,215 L 80,198 L 80,560 L 420,560 L 420,198 L 495,215 L 495,100 L 420,55 C 390,55 365,55 345,55 C 315,55 300,135 250,135 C 200,135 185,55 160,55 C 135,55 110,55 80,55 Z';

const BODY_BACK =
  'M 80,55 L 5,100 L 5,215 L 80,198 L 80,560 L 420,560 L 420,198 L 495,215 L 495,100 L 420,55 L 80,55 Z';

const SLEEVE_BODY_FRONT =
  'M 80,55 L 0,100 L 20,410 L 80,390 L 80,560 L 420,560 L 420,390 L 480,410 L 500,100 L 420,55 C 390,55 365,55 345,55 C 315,55 300,135 250,135 C 200,135 185,55 160,55 C 135,55 110,55 80,55 Z';

const SLEEVE_BODY_BACK =
  'M 80,55 L 0,100 L 20,410 L 80,390 L 80,560 L 420,560 L 420,390 L 480,410 L 500,100 L 420,55 L 80,55 Z';

const HOODIE_FRONT =
  'M 80,80 C 80,10 160,-20 250,-20 C 340,-20 420,10 420,80 L 495,115 L 495,230 L 420,210 L 420,560 L 80,560 L 80,210 L 5,230 L 5,115 Z';

const HOODIE_BACK =
  'M 80,55 L 5,100 L 5,215 L 80,198 L 80,560 L 420,560 L 420,198 L 495,215 L 495,100 L 420,55 C 390,10 310,-15 250,-15 C 190,-15 110,10 80,55 Z';

const HAT_FRONT =
  'M 100,260 C 80,200 80,80 250,60 C 420,80 420,200 400,260 L 460,275 Q 470,280 460,295 L 40,295 Q 30,280 40,275 Z';

const TSHIRT_ZONES: ZoneDefinition[] = [
  { id: 'Left Chest',   label: 'Left Chest\n2.5"–5" × 2.5"–5"',  x: 300, y: 195, w: 115, h: 90,  view: 'front' },
  { id: 'Right Chest',  label: 'Right Chest\n2.5"–5" × 2.5"–5"', x: 85,  y: 195, w: 115, h: 90,  view: 'front' },
  { id: 'Center Chest', label: 'Center Chest\n6"–10" × 6"–8"',   x: 165, y: 185, w: 170, h: 110, view: 'front' },
  { id: 'Full Front',   label: 'Full Front\n10"–12" × 10"–14"',  x: 85,  y: 175, w: 330, h: 285, view: 'front' },
  { id: 'Left Sleeve',  label: 'Left Sleeve\n1"–4" × 1"–4"',     x: 424, y: 105, w: 68,  h: 95,  view: 'front' },
  { id: 'Right Sleeve', label: 'Right Sleeve\n1"–4" × 1"–4"',    x: 8,   y: 105, w: 68,  h: 95,  view: 'front' },
  { id: 'Neck Tag',     label: 'Neck Tag\n~2"–3" wide',          x: 185, y: 60,  w: 130, h: 70,  view: 'back'  },
  { id: 'Collar/Upper Back',   label: 'Collar/Upper Back\n10"–14" × 1"–6"',    x: 95,  y: 135, w: 310, h: 120, view: 'back'  },
  { id: 'Full Back',    label: 'Full Back\n10"–14" × 6"–15"',    x: 85,  y: 130, w: 330, h: 280, view: 'back'  },
];

const HOODIE_ZONES: ZoneDefinition[] = [
  { id: 'Left Chest',      label: 'Left Chest\n2.5"–5" × 2.5"–5"',  x: 295, y: 215, w: 115, h: 90,  view: 'front' },
  { id: 'Right Chest',     label: 'Right Chest\n2.5"–5" × 2.5"–5"', x: 90,  y: 215, w: 115, h: 90,  view: 'front' },
  { id: 'Center Chest',    label: 'Center Chest\n6"–10" × 6"–8"',   x: 170, y: 205, w: 160, h: 110, view: 'front' },
  { id: 'Full Front',      label: 'Full Front\n10"–12" × 10"–14"',  x: 90,  y: 200, w: 320, h: 280, view: 'front' },
  { id: 'Pocket (literal)',label: 'Pocket\n4"–8" wide',             x: 170, y: 450, w: 160, h: 90,  view: 'front' },
  { id: 'Left Sleeve',     label: 'Left Sleeve',                    x: 422, y: 120, w: 70,  h: 80,  view: 'front' },
  { id: 'Right Sleeve',    label: 'Right Sleeve',                   x: 8,   y: 120, w: 70,  h: 80,  view: 'front' },
  { id: 'Neck Tag',        label: 'Neck Tag\n~2"–3" wide',          x: 185, y: 60,  w: 130, h: 70,  view: 'back'  },
  { id: 'Collar/Upper Back',      label: 'Collar/Upper Back\n10"–14" × 1"–6"',    x: 95,  y: 135, w: 310, h: 120, view: 'back'  },
  { id: 'Full Back',       label: 'Full Back\n10"–14" × 6"–15"',    x: 85,  y: 130, w: 330, h: 280, view: 'back'  },
];

const LONGSLEEVE_ZONES: ZoneDefinition[] = [
  { id: 'Left Chest',   label: 'Left Chest\n2.5"–5" × 2.5"–5"',  x: 300, y: 195, w: 115, h: 90,  view: 'front' },
  { id: 'Right Chest',  label: 'Right Chest\n2.5"–5" × 2.5"–5"', x: 85,  y: 195, w: 115, h: 90,  view: 'front' },
  { id: 'Center Chest', label: 'Center Chest\n6"–10" × 6"–8"',   x: 165, y: 185, w: 170, h: 110, view: 'front' },
  { id: 'Full Front',   label: 'Full Front\n10"–12" × 10"–14"',  x: 85,  y: 175, w: 330, h: 280, view: 'front' },
  { id: 'Left Sleeve',  label: 'Left Sleeve\n1"–4"',              x: 425, y: 150, w: 70,  h: 200, view: 'front' },
  { id: 'Right Sleeve', label: 'Right Sleeve\n1"–4"',             x: 5,   y: 150, w: 70,  h: 200, view: 'front' },
  { id: 'Neck Tag',     label: 'Neck Tag\n~2"–3" wide',          x: 185, y: 60,  w: 130, h: 70,  view: 'back'  },
  { id: 'Collar/Upper Back',   label: 'Collar/Upper Back\n10"–14" × 1"–6"',    x: 95,  y: 135, w: 310, h: 120, view: 'back'  },
  { id: 'Full Back',    label: 'Full Back\n10"–14" × 6"–15"',    x: 85,  y: 130, w: 330, h: 280, view: 'back'  },
];

const HAT_ZONES: ZoneDefinition[] = [
  { id: 'Center Chest', label: 'Center Front\n2"–5" wide', x: 145, y: 110, w: 210, h: 140, view: 'front' },
  { id: 'Left Chest', label: 'Left Panel', x: 60, y: 130, w: 85, h: 100, view: 'front' },
];

const POLO_ZONES: ZoneDefinition[] = [
  { id: 'Left Chest',   label: 'Left Chest\n2.5"–4" × 2.5"–4"',  x: 295, y: 215, w: 105, h: 85,  view: 'front' },
  { id: 'Right Chest',  label: 'Right Chest\n2.5"–4" × 2.5"–4"', x: 100, y: 215, w: 105, h: 85,  view: 'front' },
  { id: 'Center Chest', label: 'Center Chest\n6"–9" × 6"–8"',    x: 170, y: 215, w: 160, h: 100, view: 'front' },
  { id: 'Full Front',   label: 'Full Front\n10"–12" × 10"–14"',  x: 90,  y: 200, w: 320, h: 280, view: 'front' },
  { id: 'Neck Tag',     label: 'Neck Tag\n~2"–3" wide',           x: 185, y: 60,  w: 130, h: 70,  view: 'back'  },
  { id: 'Collar/Upper Back',   label: 'Collar/Upper Back\n10"–14" × 1"–6"',    x: 95,  y: 135, w: 310, h: 120, view: 'back'  },
  { id: 'Full Back',    label: 'Full Back\n10"–14" × 6"–15"',    x: 85,  y: 130, w: 330, h: 280, view: 'back'  },
];

export const GARMENTS: Record<GarmentType, GarmentDefinition> = {
  tshirt: {
    label: 'T-Shirts',
    frontPath: BODY_FRONT,
    backPath: BODY_BACK,
    defaultColor: '#FFFFFF',
    zones: TSHIRT_ZONES,
  },
  polo: {
    label: 'Polos',
    frontPath: BODY_FRONT,
    backPath: BODY_BACK,
    defaultColor: '#FFFFFF',
    zones: POLO_ZONES,
  },
  crewneck: {
    label: 'Crewnecks',
    frontPath: BODY_FRONT,
    backPath: BODY_BACK,
    defaultColor: '#FFFFFF',
    zones: TSHIRT_ZONES,
  },
  hoodie: {
    label: 'Hoodies',
    frontPath: HOODIE_FRONT,
    backPath: HOODIE_BACK,
    defaultColor: '#FFFFFF',
    zones: HOODIE_ZONES,
  },
  longsleeve: {
    label: 'Long Sleeves',
    frontPath: SLEEVE_BODY_FRONT,
    backPath: SLEEVE_BODY_BACK,
    defaultColor: '#FFFFFF',
    zones: LONGSLEEVE_ZONES,
  },
  hat: {
    label: 'Hats',
    frontPath: HAT_FRONT,
    backPath: HAT_FRONT,
    defaultColor: '#FFFFFF',
    zones: HAT_ZONES,
  },
};

export const GARMENT_COLORS: { label: string; value: string; dark: boolean }[] = [
  { label: 'White', value: '#FFFFFF', dark: false },
  { label: 'Black', value: '#1A1A1A', dark: true },
  { label: 'Navy', value: '#1B2A4A', dark: true },
  { label: 'Royal Blue', value: '#1560BD', dark: true },
  { label: 'Red', value: '#C8102E', dark: true },
  { label: 'Forest Green', value: '#1B5E20', dark: true },
  { label: 'Gray', value: '#9E9E9E', dark: false },
  { label: 'Charcoal', value: '#455A64', dark: true },
  { label: 'Maroon', value: '#800000', dark: true },
  { label: 'Gold', value: '#FFC107', dark: false },
  { label: 'Orange', value: '#FF6B35', dark: false },
  { label: 'Purple', value: '#6A1B9A', dark: true },
  { label: 'Light Blue', value: '#90CAF9', dark: false },
  { label: 'Pink', value: '#F48FB1', dark: false },
  { label: 'Heather Gray', value: '#B0BEC5', dark: false },
  { label: 'Dark Heather', value: '#546E7A', dark: true },
  { label: 'Athletic Heather', value: '#CFD8DC', dark: false },
  { label: 'Tan', value: '#D2B48C', dark: false },
  { label: 'Olive', value: '#556B2F', dark: true },
  { label: 'Teal', value: '#00897B', dark: true },
];

/* ──────────────────────────────────────────────────────────────────────────
 * Print Location Templates + Smart Placement
 * ────────────────────────────────────────────────────────────────────────── */

const round2 = (n: number) => Math.round(n * 100) / 100;
/** Round to the nearest quarter inch for tidy default sizing. */
const roundQuarter = (n: number) => Math.round(n * 4) / 4;

/**
 * Locations that read best as a small/embroidered placement. Everything else
 * defaults to Screen Print.
 */
const EMBROIDERY_LOCATIONS: PrintLocation[] = [
  'Left Chest',
  'Right Chest',
  'Left Sleeve',
  'Right Sleeve',
  'Neck Tag',
];

/** Optional sizing override fed from catalog DB effective-placements (inches). */
export interface TemplateSizingOverride {
  defaultWidthIn?: number | null;
  defaultHeightIn?: number | null;
  maxWidthIn?: number | null;
  maxHeightIn?: number | null;
}

/**
 * Resolve the full PrintTemplate for a zone. Priority:
 *   1. derived sensible defaults from the static zone geometry
 *   2. explicit per-zone `template` override (future per-garment presets)
 *   3. catalog DB sizing override (inch sizing only, when a product is linked)
 * Never gates on the catalog — manual/free-text products always get a template.
 */
export function resolveTemplate(
  zone: ZoneDefinition,
  dbOverride?: TemplateSizingOverride | null,
): PrintTemplate {
  const maxWidthInDerived = round2(zone.w / UNITS_PER_INCH);
  const maxHeightInDerived = round2(zone.h / UNITS_PER_INCH);

  // Default bounding box ≈ 80% of the printable area, tidied to a quarter inch.
  const base: PrintTemplate = {
    maxWidthIn: maxWidthInDerived,
    maxHeightIn: maxHeightInDerived,
    defaultWidthIn: Math.max(0.5, roundQuarter(maxWidthInDerived * 0.8)),
    defaultHeightIn: Math.max(0.5, roundQuarter(maxHeightInDerived * 0.8)),
    safeAreaIn: 0.25,
    decorationMethod: EMBROIDERY_LOCATIONS.includes(zone.id) ? 'Embroidery' : 'Screen Print',
    snap: zone.id === 'Neck Tag' ? 'top-center' : 'center',
    defaultOffsetXIn: 0,
    defaultOffsetYIn: 0,
  };

  const withZone: PrintTemplate = { ...base, ...(zone.template ?? {}) };

  if (dbOverride) {
    if (dbOverride.maxWidthIn != null) withZone.maxWidthIn = round2(dbOverride.maxWidthIn);
    if (dbOverride.maxHeightIn != null) withZone.maxHeightIn = round2(dbOverride.maxHeightIn);
    if (dbOverride.defaultWidthIn != null) withZone.defaultWidthIn = round2(dbOverride.defaultWidthIn);
    if (dbOverride.defaultHeightIn != null) withZone.defaultHeightIn = round2(dbOverride.defaultHeightIn);
  }

  // Defaults can never exceed the max.
  withZone.defaultWidthIn = Math.min(withZone.defaultWidthIn, withZone.maxWidthIn);
  withZone.defaultHeightIn = Math.min(withZone.defaultHeightIn, withZone.maxHeightIn);

  return withZone;
}

/**
 * Fit artwork into the template's default bounding box, preserving the artwork's
 * natural aspect ratio when known, and clamp the result to the template max.
 * Returns inches.
 */
export function fitDefault(
  tpl: PrintTemplate,
  naturalW?: number | null,
  naturalH?: number | null,
): { widthIn: number; heightIn: number } {
  let w = tpl.defaultWidthIn;
  let h = tpl.defaultHeightIn;

  if (naturalW && naturalH && naturalW > 0 && naturalH > 0) {
    const ratio = naturalW / naturalH; // w / h
    // Fit inside the default box.
    h = w / ratio;
    if (h > tpl.defaultHeightIn) {
      h = tpl.defaultHeightIn;
      w = h * ratio;
    }
    // Clamp to max, preserving ratio.
    if (w > tpl.maxWidthIn) {
      w = tpl.maxWidthIn;
      h = w / ratio;
    }
    if (h > tpl.maxHeightIn) {
      h = tpl.maxHeightIn;
      w = h * ratio;
    }
  } else {
    w = Math.min(w, tpl.maxWidthIn);
    h = Math.min(h, tpl.maxHeightIn);
  }

  return { widthIn: round2(w), heightIn: round2(h) };
}

export interface ArtPlacementInput {
  widthIn: number;
  heightIn: number;
  snap: SnapPosition;
  offsetXIn: number;
  offsetYIn: number;
  safeAreaIn: number;
}

/**
 * Compute the absolute artwork rectangle (canvas units) inside a zone, honoring
 * real inch sizing, the safe-area inset, the snap anchor and any manual offset.
 * The result is clamped to stay within the zone bounds. Used by BOTH the
 * on-screen overlay and the export canvas so they stay pixel-identical.
 */
export function computeArtRect(zone: ZoneDefinition, input: ArtPlacementInput) {
  const upi = UNITS_PER_INCH;
  const inset = Math.max(0, input.safeAreaIn) * upi;
  const sx = zone.x + inset;
  const sy = zone.y + inset;
  const sw = Math.max(1, zone.w - inset * 2);
  const sh = Math.max(1, zone.h - inset * 2);

  const aw = Math.min(Math.max(1, input.widthIn * upi), sw);
  const ah = Math.min(Math.max(1, input.heightIn * upi), sh);

  let ax: number;
  let ay: number;
  switch (input.snap) {
    case 'top-center':
      ax = sx + (sw - aw) / 2;
      ay = sy;
      break;
    case 'bottom-center':
      ax = sx + (sw - aw) / 2;
      ay = sy + (sh - ah);
      break;
    case 'left':
      ax = sx;
      ay = sy + (sh - ah) / 2;
      break;
    case 'right':
      ax = sx + (sw - aw);
      ay = sy + (sh - ah) / 2;
      break;
    case 'center':
    default:
      ax = sx + (sw - aw) / 2;
      ay = sy + (sh - ah) / 2;
      break;
  }

  ax += input.offsetXIn * upi;
  ay += input.offsetYIn * upi;

  // Clamp the whole rect inside the zone.
  ax = Math.max(zone.x, Math.min(ax, zone.x + zone.w - aw));
  ay = Math.max(zone.y, Math.min(ay, zone.y + zone.h - ah));

  return { x: ax, y: ay, w: aw, h: ah };
}

/** Map the DB PlacementType enum to the Mockup Designer's PrintLocation. */
export const PLACEMENT_TYPE_TO_LOCATION: Record<string, PrintLocation> = {
  LEFT_CHEST: 'Left Chest',
  FULL_FRONT: 'Full Front',
  FULL_BACK: 'Full Back',
  YOKE: 'Collar/Upper Back',
  SLEEVE_LEFT: 'Left Sleeve',
  SLEEVE_RIGHT: 'Right Sleeve',
};

/** Approximate float comparison for template-status derivation. */
export const approxEqual = (a: number, b: number, tol = 0.05) => Math.abs(a - b) <= tol;
