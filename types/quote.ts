export type ServiceStyle = 'Screen Printing' | 'Direct to Film' | 'Embroidery' | 'Promotional' | 'DTF Transfers' | 'Design Work';
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
   * Still written for backward compat; read as configuredProducts[0] when
   * configuredProducts is absent. Populated by migration and kept in sync
   * by LineItemCard on every save.
   */
  configuredProduct?: import('./configuredProduct').ConfiguredProduct;
  /**
   * configuredProducts — canonical multi-product array for a Design.
   * Each entry is a distinct garment (Adult Tee, Youth Tee, etc.) sharing
   * the same artwork, locations, service calculator, and line-item pricing
   * fields (service cost, fees, markup). Only productCostEach differs per
   * product. When present, this drives ALL pricing calculations instead of
   * the legacy blended productCostEach on the LineItem.
   */
  configuredProducts?: import('./configuredProduct').ConfiguredProduct[];
}

export interface QuoteCalculations {
  totalQuantity: number;
  productCostEach: number;
  productCostTotal: number;
  serviceCostEach: number;
  serviceCostTotal: number;
  serviceFeeEach: number;
  serviceFeeTotal: number;
  cogEach: number;
  cogTotal: number;
  markupAmount: number;
  markupPercentage: number;
  subtotal: number;
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
  serviceFeeTotal: number;
  markupTotal: number;
  cogTotal: number;
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
  'Design Work',
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
