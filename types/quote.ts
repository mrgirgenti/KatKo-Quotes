export type ServiceStyle = 'Screen Printing' | 'Direct to Film' | 'Embroidery' | 'Promotional';
export type OrderType = 'New' | 'Re-Order';

export type QuoteStatus = 'draft' | 'quoted' | 'active' | 'completed' | 'expired';

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
  personOrganization: string;
  projectName: string;
  orderType: OrderType;
  orderDate: string;
  inHandsDate: string;
  invoiceNumber: string;
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
}

export interface SalesCalculations {
  actualCOG: number;
  actualProfit: number;
  actualProfitMargin: number;
  quotedVsActualCOGDiff: number;
  quotedVsActualProfitDiff: number;
}

export interface LineItemCalculations {
  quantity: number;
  productCostTotal: number;
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
];

export const ORDER_TYPES: OrderType[] = ['New', 'Re-Order'];

export const PRODUCTS = [
  'Next Level 6210',
  'Bella+Canvas 3001',
  'Comfort Colors 1717',
  'Next Level 3605',
  'Next Level 1540',
  'Gildan 64000',
  'Gildan 2000 (Ultra)',
  'Gildan 5000 (Heavy)',
  'Gildan 8000 (Heavy)',
  'Shaka Wear SHGD',
  'Hats: YP Classics 6506',
  'Hats: YP Classics 6606',
  'Hats: Richardson 112',
  'Hats: Otto 31-069 5 Panel Mid',
  'Polos: ST550',
  'Polos: LST550',
  'Sweats: Lane Seven LS14004',
] as const;

export const PRODUCT_COLORS = [
  'Black',
  'Cream',
  'Heather Grey',
  'Sport Grey',
  'Natural',
  'Navy',
  'Red',
  'White',
] as const;

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
  draft:     { label: 'Draft',     color: '#6B7280', bg: '#F3F4F6', borderColor: '#D1D5DB' },
  quoted:    { label: 'Quoted',    color: '#2563EB', bg: '#EFF6FF', borderColor: '#BFDBFE' },
  active:    { label: 'Active',    color: '#FFFFFF', bg: '#FF5A00', borderColor: '#FF5A00' },
  completed: { label: 'Completed', color: '#FFFFFF', bg: '#16A34A', borderColor: '#16A34A' },
  expired:   { label: 'Expired',   color: '#9CA3AF', bg: '#F9FAFB', borderColor: '#E5E7EB' },
};
