export type ServiceStyle = 'Screen Printing' | 'Direct to Film' | 'Embroidery' | 'Promotional' | 'DTF Transfers';
export type OrderType = 'New' | 'Re-Order';

export type QuoteStatus = 'draft' | 'needs_review' | 'quoting' | 'quoted' | 'invoice_sent' | 'paid' | 'active' | 'production_started' | 'completed' | 'expired';

export interface LineItemActualCosts {
  lineItemId: string;
  actualProductCost: number;
  productVendor: string;
  actualServiceCost: number;
  applicator: string;
  actualServiceFeesCost: number;
  actualServiceFeesProfit: number;
  actualOtherCosts: number;
  otherCostsDescription: string;
}

export interface SalesData {
  convertedDate: string;
  completedDate: string;
  actualProductCost: number;
  productVendors: string[];
  actualServiceCost: number;
  applicator: string;
  actualServiceFeesCost: number;
  actualServiceFeesProfit: number;
  actualOtherCosts: number;
  otherCostsDescription: string;
  actualOnlineFee: number;
  actualSalesTax: number;
  actualCardFee: number;
  amountCollected: number;
  notes: string;
  lineItemCosts?: LineItemActualCosts[];
}

export interface SizeQuantities {
  xs: number;
  s: number;
  m: number;
  l: number;
  xl: number;
  xxl: number;
  xxxl: number;
  xxxxl: number;
  flat: number;
}

export interface GarmentVariant {
  product: string;
  color: string;
  sizes: SizeQuantities;
  // ── Catalog awareness (Phase 1) — all optional, additive, backward-compatible ──
  // Present ONLY when this variant is linked to a curated catalog Product.
  // Absent = manual/free-text entry (the default, never gated on the catalog).
  productId?: string;
  styleNumber?: string;
  brand?: string;
  productName?: string;
  productSource?: 'catalog' | 'manual' | 'vendor_api';
  // Category of the garment (e.g. "T-Shirts", "Hats") — populated from catalog
  // or set manually via the category pill selector.
  category?: string;
}

/**
 * Per-product cost breakdown row used in LINE ITEM COSTS display.
 * Reflects the true extended cost for each product under a design —
 * never a weighted average. productCostTotal = Σ(extendedCost).
 */
export interface ProductCostRow {
  /** Human-readable label, e.g. "NL6210 — CVC Crew Tee" or "Adult Tee" */
  productLabel: string;
  productCostEach: number;
  quantity: number;
  /** productCostEach × quantity — exact, not averaged */
  extendedCost: number;
}

/**
 * Calculation type for an itemized adjustment (Production Cost / Other Charge).
 * Drives how the row's "Calculated" value is derived from its detail inputs.
 */
export type AdjustmentCalcType = 'flat' | 'hourly' | 'per_unit' | 'per_design' | 'percentage' | 'custom';

export const ADJUSTMENT_CALC_TYPES: { value: AdjustmentCalcType; label: string }[] = [
  { value: 'flat', label: 'Flat Rate' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'per_unit', label: 'Per Unit' },
  { value: 'per_design', label: 'Per Design' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'custom', label: 'Custom' },
];

/**
 * A single itemized adjustment row shown in the Quote Builder's PRODUCTION COSTS
 * and OTHER CHARGES tables. Each row's value is derived via calcAdjustmentAmount
 * (utils/quoteCalculations.ts). The rows ARE summed into the pricing engine:
 * PRODUCTION COSTS → the Production bucket, OTHER CHARGES → the Other Charges
 * bucket, both flowing into the line subtotal, Quote Summary, and Grand Total.
 */
export interface QuoteAdjustment {
  id: string;
  /** Free-text label, e.g. "Design Fee", "Rush", "Shipping". */
  name: string;
  type: AdjustmentCalcType;
  /** Flat amount ($), hourly rate ($/hr), per-unit rate ($/unit), or percent value. */
  rate: number;
  /** Hours or units — used by hourly / per_unit only. */
  quantity: number;
}

export interface LineItem {
  id: string;
  designName: string;
  applicator: string;
  product: string;
  productColor: string;
  apparelProvider: string;
  serviceStyle: ServiceStyle;
  location1: string;
  location2: string;
  location3?: string;
  location4?: string;
  locationDetails: string;
  sizes: SizeQuantities;
  garmentVariants?: GarmentVariant[];
  productCostEach: number;
  serviceCostEach: number;
  serviceFeeEach: number;
  markupEach: number;
  mockupUri?: string;
  completedAt?: string;
  /**
   * configuredProduct — LEGACY single-product field.
   * Still written for backward compat; read as products[0] when
   * products[] is absent. Populated by migration and kept in sync
   * by LineItemCard on every save.
   */
  configuredProduct?: import('./configuredProduct').ConfiguredProduct;
  /**
   * products[] — multi-product array. A single Line Item ("Design") may hold
   * MULTIPLE distinct garments (Products) that share the same artwork/mockup,
   * locations, calculator, notes, services, fees and markup. This is the new
   * canonical UI source. `configuredProduct` (singular) stays populated as the
   * PRIMARY product (products[0]) for backward compatibility; old quotes with no
   * `products` array read as a one-element array. All sync/aggregation/blend
   * logic lives in `utils/lineItemProducts.ts`. The flat aggregate `sizes` and
   * flat per-each pricing fields are derived from this array on every edit so
   * the pricing engine stays untouched.
   */
  products?: import('./configuredProduct').ConfiguredProduct[];
  /**
   * Per-line-item priority — mirrors the project-level priority but scoped to
   * the design so that individual designs within a project can be flagged
   * independently. Synced to the project-level field on save.
   */
  priority?: ProjectPriority | null;
  /**
   * Rush flag for this design — drives the "Rush Service" chip in Additional
   * Services and adds a rush fee when the calculator is applied.
   */
  rush?: boolean;
  /**
   * Other Charges — flat dollar amount for charges outside the production cost
   * base (e.g. Rush, Shipping, Delivery, Fulfillment, Discounts).
   * Not multiplied by quantity; treated as a flat line-item total.
   */
  otherCostEach?: number;
  /**
   * PRODUCTION COSTS — itemized production-related adjustments shown in the Quote
   * Builder's "PRODUCTION COSTS" table (e.g. Design Fee, Digitizing, Screen Setup).
   * Summed into the pricing engine's Production bucket. When present it supersedes
   * the legacy flat `serviceFeeEach` scalar; old quotes without rows fall back to it.
   */
  productionCosts?: QuoteAdjustment[];
  /**
   * OTHER CHARGES — itemized non-production adjustments shown in the Quote
   * Builder's "OTHER CHARGES" table (e.g. Rush, Shipping, Restocking, Discount).
   * Summed into the pricing engine's Other Charges bucket. When present it supersedes
   * the legacy flat `otherCostEach` scalar; old quotes without rows fall back to it.
   */
  otherCharges?: QuoteAdjustment[];
}

export interface DiscountData {
  type: 'percentage' | 'dollar';
  value: number;
  reason: string;
  customReason?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface QuoteCalculations {
  totalQuantity: number;
  productCostEach: number;
  productCostTotal: number;
  serviceCostEach: number;
  serviceCostTotal: number;
  /** @deprecated Use productionCostEach — same value, new terminology */
  serviceFeeEach: number;
  /** @deprecated Use productionCostTotal — same value, new terminology */
  serviceFeeTotal: number;
  /** Production bucket (was: Service Fees) each — flat fee ÷ totalQuantity for display */
  productionCostEach: number;
  /** Production bucket (was: Service Fees) total — sum of all line item production costs */
  productionCostTotal: number;
  /** Other Charges bucket each — otherCostTotal ÷ totalQuantity for display */
  otherCostEach: number;
  /** Other Charges bucket total — sum of all line item other charges */
  otherCostTotal: number;
  /** Production Cost base (Product + Service + Production) each */
  cogEach: number;
  /** Production Cost base (Product + Service + Production) total */
  cogTotal: number;
  markupAmount: number;
  markupPercentage: number;
  subtotal: number;
  /** Dollar amount discounted off the gross subtotal (0 when no discount). */
  discountAmount?: number;
  /** Subtotal after discount is applied — the basis for all fee/tax calculations. */
  discountedSubtotal?: number;
  /** The type of discount applied ('percentage' or 'dollar'). */
  discountType?: 'percentage' | 'dollar';
  /** The raw input value (e.g. 10 for "10%", 50 for "$50"). */
  discountValue?: number;
  onlineFee: number;
  salesTax: number;
  cardFee: number;
  total: number;
  totalPerPiece: number;
}

export interface Quote {
  id: string;
  userId?: string;
  orgId?: string;
  intakeSource?: string;
  personOrganization: string;
  projectName: string;
  orderType: OrderType;
  orderDate: string;
  inHandsDate: string;
  invoiceNumber: string;
  projectNumber?: string;
  lineItems: LineItem[];
  markupEach: number;
  hasOnlineFee: boolean;
  hasSalesTax: boolean;
  hasCardFee: boolean;
  calculations: QuoteCalculations;
  createdAt: string;
  status: QuoteStatus;
  activeDate?: string;
  salesData?: SalesData;
  isLocked?: boolean;
  lockedDate?: string;
  exportedToSheets?: boolean;
  exportedToSheetsDate?: string;
  quoteSentAt?: string;
  notesClient?: string;
  waveInvoiceLink?: string;
  operationalStatus?: OperationalProjectStatus | null;
  holdReason?: string | null;
  holdNotes?: string | null;
  holdPlacedAt?: string | null;
  holdPlacedBy?: string | null;
  deliveryMethod?: DeliveryMethod | null;
  paymentReceived?: boolean;
  artworkReceived?: boolean;
  proofApproved?: boolean;
  priority?: ProjectPriority | null;
  assignedToUserId?: string | null;
  rush?: boolean;
  discountData?: DiscountData;
  // Computed mockup DTO fields — populated by API, consumed by all display surfaces.
  // Never independently derived in components; always read from the project object.
  primaryMockup?: string | null;
  mockupGallery?: string[];
  mockupCount?: number;
  resolvedImageSource?: 'mockup' | 'fallback';
}

export type ProjectPriority = 'Critical' | 'High' | 'Normal' | 'Low';

export const PROJECT_PRIORITIES: ProjectPriority[] = ['Critical', 'High', 'Normal', 'Low'];

export const DEFAULT_PRIORITY: ProjectPriority = 'Normal';

// Lower rank = higher priority (used for sorting Critical first).
export const PRIORITY_RANK: Record<ProjectPriority, number> = {
  Critical: 0,
  High: 1,
  Normal: 2,
  Low: 3,
};

export const PRIORITY_CONFIG: Record<ProjectPriority, { label: string; color: string; bg: string; borderColor: string }> = {
  Critical: { label: 'Critical', color: '#FFFFFF', bg: '#DC2626', borderColor: '#DC2626' },
  High:     { label: 'High',     color: '#FFFFFF', bg: '#EA580C', borderColor: '#EA580C' },
  Normal:   { label: 'Normal',   color: '#1D4ED8', bg: '#DBEAFE', borderColor: '#93C5FD' },
  Low:      { label: 'Low',      color: '#4B5563', bg: '#F3F4F6', borderColor: '#D1D5DB' },
};

export type OperationalProjectStatus =
  | 'Accepted'
  | 'Awaiting Artwork'
  | 'Artwork Approval'
  | 'Awaiting Payment'
  | 'Ready for Production'
  | 'In Production'
  | 'On Hold'
  | 'Completed'
  | 'Delivered'
  | 'Closed';

export type DeliveryMethod = 'Pickup' | 'Shipping' | 'Local Delivery';

export type HoldReason =
  | 'Waiting on Customer'
  | 'Waiting on Artwork'
  | 'Waiting on Inventory'
  | 'Waiting on Payment'
  | 'Internal Delay'
  | 'Other';

export const OPERATIONAL_STATUSES: OperationalProjectStatus[] = [
  'Accepted',
  'Awaiting Artwork',
  'Artwork Approval',
  'Awaiting Payment',
  'Ready for Production',
  'In Production',
  'On Hold',
  'Completed',
  'Delivered',
  'Closed',
];

export const OPERATIONAL_STATUS_CONFIG: Record<OperationalProjectStatus, { label: string; color: string; bg: string; borderColor: string }> = {
  'Accepted':            { label: 'Accepted',            color: '#1D4ED8', bg: '#DBEAFE', borderColor: '#93C5FD' },
  'Awaiting Artwork':    { label: 'Awaiting Artwork',    color: '#92400E', bg: '#FEF3C7', borderColor: '#FDE68A' },
  'Artwork Approval':    { label: 'Artwork Approval',    color: '#6D28D9', bg: '#EDE9FE', borderColor: '#C4B5FD' },
  'Awaiting Payment':    { label: 'Awaiting Payment',    color: '#B45309', bg: '#FEF3C7', borderColor: '#FCD34D' },
  'Ready for Production': { label: 'Ready for Production', color: '#0F766E', bg: '#CCFBF1', borderColor: '#5EEAD4' },
  'In Production':       { label: 'In Production',        color: '#FFFFFF', bg: '#FF5A00', borderColor: '#FF5A00' },
  'On Hold':            { label: 'On Hold',             color: '#FFFFFF', bg: '#DC2626', borderColor: '#DC2626' },
  'Completed':          { label: 'Completed',           color: '#FFFFFF', bg: '#16A34A', borderColor: '#16A34A' },
  'Delivered':          { label: 'Delivered',           color: '#FFFFFF', bg: '#059669', borderColor: '#059669' },
  'Closed':             { label: 'Closed',              color: '#374151', bg: '#E5E7EB', borderColor: '#D1D5DB' },
};

// Logical next-step transitions shown to normal (non-admin) users.
// On Hold is offered separately and is always available; admins can jump anywhere.
export const OPERATIONAL_NEXT: Record<OperationalProjectStatus, OperationalProjectStatus[]> = {
  'Accepted':            ['Awaiting Artwork'],
  'Awaiting Artwork':    ['Artwork Approval'],
  'Artwork Approval':    ['Awaiting Payment'],
  'Awaiting Payment':    ['Ready for Production'],
  'Ready for Production': ['In Production'],
  'In Production':       ['Completed'],
  'On Hold':            [],
  'Completed':          ['Delivered'],
  'Delivered':          ['Closed'],
  'Closed':             [],
};

export const HOLD_REASONS: HoldReason[] = [
  'Waiting on Customer',
  'Waiting on Artwork',
  'Waiting on Inventory',
  'Waiting on Payment',
  'Internal Delay',
  'Other',
];

export const DELIVERY_METHODS: DeliveryMethod[] = ['Pickup', 'Shipping', 'Local Delivery'];

export interface SalesCalculations {
  actualCOG: number;
  actualProfit: number;
  actualProfitMargin: number;
  quotedVsActualCOGDiff: number;
  quotedVsActualProfitDiff: number;
}

export interface LineItemCalculations {
  quantity: number;
  /** Exact sum of (productCostEach × qty) for every product in this design. Never a weighted average. */
  productCostTotal: number;
  /** Per-product breakdown rows when the line item has multiple products. Omitted for single-product items. */
  productCostRows?: ProductCostRow[];
  serviceCostTotal: number;
  /** Production bucket total (was: serviceFeeTotal) — flat production costs (Design Fee, Digitizing, etc.) */
  productionCostTotal: number;
  /** Other Charges bucket total — flat other charges (Rush, Shipping, etc.) */
  otherCostTotal: number;
  /** @deprecated Use productionCostTotal */
  serviceFeeTotal: number;
  markupTotal: number;
  /** Production Cost base = productCostTotal + serviceCostTotal + productionCostTotal */
  cogTotal: number;
  /**
   * Base for percentage-type adjustments = productCostTotal + serviceCostTotal + markupTotal
   * (the line subtotal BEFORE Production/Other adjustments). Stable and non-circular;
   * the Quote Builder adjustment tables pass this so their "Calculated" column matches the engine.
   */
  adjustmentBase: number;
  subtotal: number;
  perPiece: number;
}

export const EMPTY_SIZES: SizeQuantities = {
  xs: 0,
  s: 0,
  m: 0,
  l: 0,
  xl: 0,
  xxl: 0,
  xxxl: 0,
  xxxxl: 0,
  flat: 0,
};

export const SIZE_LABELS_ROW1: { key: keyof SizeQuantities; label: string }[] = [
  { key: 'xs', label: 'XS' },
  { key: 's', label: 'SM' },
  { key: 'm', label: 'MD' },
  { key: 'l', label: 'LG' },
];

export const SIZE_LABELS_ROW2: { key: keyof SizeQuantities; label: string }[] = [
  { key: 'xl', label: 'XL' },
  { key: 'xxl', label: '2XL' },
  { key: 'xxxl', label: '3XL' },
  { key: 'xxxxl', label: '4XL' },
];

export const SIZE_LABELS: { key: keyof SizeQuantities; label: string }[] = [
  ...SIZE_LABELS_ROW1,
  ...SIZE_LABELS_ROW2,
];

export const SERVICE_STYLES: ServiceStyle[] = [
  'Direct to Film',
  'Screen Printing',
  'Embroidery',
  'Promotional',
  'DTF Transfers',
];

export const ORDER_TYPES: OrderType[] = ['New', 'Re-Order'];

export const APPAREL_PROVIDERS = [
  "McCreary's",
  'S&S Activewear',
  'SanMar',
  'Shaka Wear',
  'Otto Caps',
  'LA Apparel',
  'Independent',
  'Amazon',
  '** Client Provided',
] as const;

export const VENDORS = [
  "McCreary's",
  'SS Activewear',
  'San Mar',
  'Independent',
  'LA Apparel',
  'Amazon',
  '** Client Provided',
] as const;

export const APPLICATORS = [
  'Katalyst Ko Printshop',
  'Show & Tell Tees',
  'Express SP',
  'Jim (MBF Laser)',
  'Bowdacious Creations',
  'Anna (Embroidery)',
  'Wolf Digitization',
] as const;

export const LOCATIONS = [
  'Left Chest',
  'Right Chest',
  'Center Chest',
  'Full Front',
  'Upper Back',
  'Full Back',
  'Neck Tag',
  'Left Sleeve',
  'Right Sleeve',
  'Pocket (literal)',
] as const;

export function getEffectiveStatus(quote: Quote): QuoteStatus {
  if (quote.status === 'quoted') {
    const dateStr = quote.orderDate;
    if (dateStr) {
      const date = new Date(dateStr.replace(/-/g, '/'));
      if (!isNaN(date.getTime())) {
        const daysSince = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince > 30) return 'expired';
      }
    }
  }
  return quote.status;
}

export const STATUS_CONFIG: Record<QuoteStatus, { label: string; color: string; bg: string; borderColor: string }> = {
  draft:              { label: 'Draft',         color: '#6B7280', bg: '#F3F4F6', borderColor: '#D1D5DB' },
  needs_review:       { label: 'Needs Review',  color: '#FFFFFF', bg: '#DC2626', borderColor: '#B91C1C' },
  quoting:            { label: 'Quoting',        color: '#1D4ED8', bg: '#DBEAFE', borderColor: '#93C5FD' },
  quoted:             { label: 'Quoted',         color: '#FFFFFF', bg: '#6B7280', borderColor: '#4B5563' },
  invoice_sent:       { label: 'Invoice Sent',   color: '#FFFFFF', bg: '#4F46E5', borderColor: '#4338CA' },
  paid:               { label: 'Paid',           color: '#FFFFFF', bg: '#16A34A', borderColor: '#16A34A' },
  active:             { label: 'In Production',  color: '#FFFFFF', bg: '#7C3AED', borderColor: '#6D28D9' },
  production_started: { label: 'In Production',  color: '#FFFFFF', bg: '#7C3AED', borderColor: '#7C3AED' },
  completed:          { label: 'Completed',       color: '#FFFFFF', bg: '#16A34A', borderColor: '#16A34A' },
  expired:            { label: 'Expired',         color: '#9CA3AF', bg: '#F9FAFB', borderColor: '#E5E7EB' },
};

export const STATUS_HIERARCHY: Record<QuoteStatus, number> = {
  draft:              0,
  needs_review:       1,
  quoting:            2,
  expired:            2,
  quoted:             3,
  invoice_sent:       4,
  paid:               5,
  active:             6,
  production_started: 7,
  completed:          8,
};
