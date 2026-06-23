// ─────────────────────────────────────────────────────────────────────────────
// Project Document model — the single source of truth that powers EVERY rendering
// of a project as a document: the Client Hub Order Detail (web), and the Quote /
// Invoice / Production Punch Sheet PDFs. One model, one layout. The `mode` only
// controls VISIBILITY (which sections/columns appear), never the layout itself.
//
// PRODUCT MODEL LAW: quoting/mockups are never gated on the curated catalog. This
// module reads free-text line item fields directly and never assumes a catalog link.
//
// PRICING PRIVACY: customer-facing output (QUOTE / INVOICE / ORDER_DETAIL) exposes
// ONLY the bundled customer per-piece price and totals. It NEVER exposes product
// cost, service cost, service fees, markup, COGS, margin, or vendor cost. PRODUCTION
// hides all pricing entirely.
// ─────────────────────────────────────────────────────────────────────────────

import { LineItem, SIZE_LABELS } from '@/types/quote';
import { calculateLineItemSubtotal } from '@/utils/quoteCalculations';

export type DocumentMode = 'QUOTE' | 'INVOICE' | 'PRODUCTION' | 'ORDER_DETAIL';

export interface DocumentVisibility {
  title: string;
  numberLabel: string;
  secondaryDateLabel: string | null;
  /** PRICING column (PER PIECE | TOTAL) on each line item + the ORDER TOTAL block. */
  showPricing: boolean;
  /** PRODUCTION replaces the PRICING column with a blank NOTES column for the floor. */
  showNotesColumn: boolean;
  /** Bottom-left disclaimer / NOTES box (customer-facing modes). */
  showNotesBox: boolean;
  /** "Ready to move forward?" approval callout (QUOTE / ORDER_DETAIL). */
  showApprovalCallout: boolean;
  /** PRODUCTION: blank PRODUCTION NOTES / SPECIAL INSTRUCTIONS box. */
  showProductionNotesBox: boolean;
  /** PRODUCTION: pre-flight CHECKLIST. */
  showChecklist: boolean;
  /** "Thank you for your business!" footer (customer-facing modes). */
  showThankYouFooter: boolean;
}

export interface DocSizeRow {
  label: string;
  qty: number;
}

export interface DocLineItem {
  number: number;
  name: string;
  product: string;
  decoration: string;
  locations: string[];
  notes: string;
  mockups: string[];
  /** Hats / promo / one-size items show a single QTY column (no size breakdown). */
  singleQtyColumn: boolean;
  sizeRows: DocSizeRow[];
  totalQty: number;
  perPiece: number;
  itemTotal: number;
}

export interface DocTotalRow {
  label: string;
  value: number;
  isGrandTotal?: boolean;
}

export interface DocCustomer {
  name: string;
  addressLines: string[];
  phone: string | null;
}

export interface ProjectDocumentModel {
  mode: DocumentMode;
  visibility: DocumentVisibility;
  documentNumber: string | null;
  date: string | null;
  secondaryDate: string | null;
  projectName: string;
  customer: DocCustomer;
  notes: string;
  lineItems: DocLineItem[];
  grandTotalQty: number;
  totals: DocTotalRow[];
}

/** Permissive source: satisfied by both a staff `Quote` and a portal `proj` record. */
export interface DocumentSource {
  personOrganization?: string;
  projectName?: string;
  title?: string;
  invoiceNumber?: string;
  projectNumber?: string;
  orderDate?: string;
  inHandsDate?: string;
  dueDate?: string;
  createdAt?: string;
  notesClient?: string;
  notes?: string;
  lineItems?: any[];
  lineItemsData?: any[];
  calculations?: any;
  [key: string]: any;
}

export interface BuildOptions {
  customer?: Partial<DocCustomer>;
  notes?: string;
}

// ── Boilerplate document copy (company policy text shown on customer docs) ────────

export const DEFAULT_DOC_NOTES =
  'Please check all details before production.\nContact sales with any questions.';

export const DOC_NOTE_BULLETS: string[] = [
  'Pricing includes all setup and decoration.',
  'Mockup colors may vary slightly from the final product.',
  'We typically ask for 10–14 business days for most projects. The in-hands date is estimated and not always guaranteed.',
  'All balances must be paid in full prior to production.',
  'Invoices paid with a card incur a 3.5% processing fee. Zelle payments are not charged — email jobs@katalystko.com.',
  'Payment in full authorizes production to begin immediately.',
];

export const DOC_DISCLAIMER =
  'Due to the custom nature of our work, all sales are final once payment is received. No refunds, exchanges, or cancellations permitted. Exceptions, if any, are granted solely at the discretion of management. Please allow for 2–3% spoilage. In the rare occasion an item is damaged or misprinted, we will not be able to replace customer-provided products.';

export const DOC_APPROVAL_CALLOUT = {
  title: 'Ready to move forward?',
  body: 'Approve this quote to lock in pricing and move your project into production!',
};

export const PRODUCTION_CHECKLIST: string[] = [
  'Artwork Approved',
  'Sizes & Quantities Verified',
  'Garment Colors Verified',
  'Decoration & Locations Verified',
  'All Details Confirmed',
];

export const DOC_FOOTER = {
  line1: 'Thank you for your business!',
  line2: 'We appreciate the opportunity to earn it.',
};

// ── Visibility rules per mode (the ONLY thing the mode changes) ──────────────────

export function getModeVisibility(mode: DocumentMode): DocumentVisibility {
  switch (mode) {
    case 'INVOICE':
      return {
        title: 'INVOICE',
        numberLabel: 'Invoice #',
        secondaryDateLabel: 'Due Date',
        showPricing: true,
        showNotesColumn: false,
        showNotesBox: true,
        showApprovalCallout: false,
        showProductionNotesBox: false,
        showChecklist: false,
        showThankYouFooter: true,
      };
    case 'PRODUCTION':
      return {
        title: 'PRODUCTION PUNCH SHEET',
        numberLabel: 'Project #',
        secondaryDateLabel: 'In Hands Date',
        showPricing: false,
        showNotesColumn: true,
        showNotesBox: false,
        showApprovalCallout: false,
        showProductionNotesBox: true,
        showChecklist: true,
        showThankYouFooter: false,
      };
    case 'ORDER_DETAIL':
      return {
        title: 'ORDER DETAIL',
        numberLabel: 'Order #',
        secondaryDateLabel: 'In Hands Date',
        showPricing: true,
        showNotesColumn: false,
        showNotesBox: true,
        showApprovalCallout: false,
        showProductionNotesBox: false,
        showChecklist: false,
        showThankYouFooter: true,
      };
    case 'QUOTE':
    default:
      return {
        title: 'QUOTE',
        numberLabel: 'Quote #',
        secondaryDateLabel: 'In Hands Date',
        showPricing: true,
        showNotesColumn: false,
        showNotesBox: true,
        showApprovalCallout: true,
        showProductionNotesBox: false,
        showChecklist: false,
        showThankYouFooter: true,
      };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function isValidImageUrl(u: unknown): u is string {
  if (typeof u !== 'string') return false;
  const s = u.trim();
  if (!s) return false;
  return (
    s.startsWith('http://') ||
    s.startsWith('https://') ||
    s.startsWith('data:image/') ||
    s.startsWith('/')
  );
}

function collectMockups(li: any): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    if (isValidImageUrl(v) && !out.includes(v)) out.push(v);
  };
  push(li?.mockupUri);
  const arr = li?.mockups ?? li?.mockupUris ?? li?.images;
  if (Array.isArray(arr)) {
    for (const m of arr) {
      if (typeof m === 'string') push(m);
      else if (m && typeof m === 'object') push(m.url ?? m.uri ?? m.fileUrl ?? m.src);
    }
  }
  return out.slice(0, 4);
}

export function formatDocDate(raw?: string | null): string | null {
  if (!raw) return null;
  const d = new Date(String(raw).replace(/-/g, '/'));
  if (isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function num(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

/** First finite number among the candidates, else null. */
function pickNum(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (v == null || v === '') continue;
    const n = Number(v);
    if (!isNaN(n)) return n;
  }
  return null;
}

function buildLineItem(li: any, index: number): DocLineItem {
  const calc = calculateLineItemSubtotal(li as LineItem);
  const isPromotional = li?.serviceStyle === 'Promotional';

  const sized = SIZE_LABELS.filter(({ key }) => num(li?.sizes?.[key]) > 0).map(({ key, label }) => ({
    label,
    qty: num(li?.sizes?.[key]),
  }));
  const flatQty = num(li?.sizes?.flat);

  let sizeRows: DocSizeRow[];
  let singleQtyColumn: boolean;
  if (isPromotional || (sized.length === 0 && flatQty > 0)) {
    singleQtyColumn = true;
    sizeRows = [{ label: 'QTY', qty: calc.quantity }];
  } else {
    singleQtyColumn = false;
    sizeRows = [...sized];
    if (flatQty > 0) sizeRows.push({ label: 'Flat', qty: flatQty });
  }

  const locations = [li?.location1, li?.location2, li?.location3, li?.location4]
    .map((l) => (typeof l === 'string' ? l.trim() : ''))
    .filter(Boolean);

  const productParts = [li?.product, li?.productColor]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);

  // Customer-safe explicit prices win over cost-derived calc. A sanitized portal
  // payload strips every cost/markup input, so calculateLineItemSubtotal would
  // return 0 there; the server hands us the already-bundled customer price
  // instead. Staff Quote line items carry no such field, so calc is used.
  const explicitPer = pickNum(li?.customerUnitPrice, li?.unitPrice, li?.perPiece);
  const explicitTotal = pickNum(li?.customerLineTotal, li?.lineTotal, li?.itemTotal);

  return {
    number: index + 1,
    name: (li?.designName && String(li.designName).trim()) || 'Untitled Design',
    product: productParts.join(' - ') || '—',
    decoration: (li?.serviceStyle && String(li.serviceStyle)) || '—',
    locations: locations.length ? locations : ['N/A'],
    notes: (li?.locationDetails && String(li.locationDetails).trim()) || 'N/A',
    mockups: collectMockups(li),
    singleQtyColumn,
    sizeRows,
    totalQty: calc.quantity,
    perPiece: explicitPer != null ? explicitPer : calc.perPiece,
    itemTotal: explicitTotal != null ? explicitTotal : calc.subtotal,
  };
}

function buildTotals(calc: any): DocTotalRow[] {
  if (!calc) return [];
  const subtotal = num(calc.subtotal);
  const total = calc.total != null ? num(calc.total) : subtotal;
  // Pending pricing — a calc object exists but holds no real numbers yet (e.g. an
  // unquoted project). Emit no rows so renderBottom shows the NOTES box full width
  // instead of a misleading $0.00 ORDER TOTAL.
  if (subtotal <= 0 && total <= 0) return [];
  const rows: DocTotalRow[] = [];
  rows.push({ label: 'Subtotal', value: subtotal });
  if (num(calc.onlineFee) > 0) rows.push({ label: 'Online Fee (2.9%)', value: num(calc.onlineFee) });
  if (num(calc.cardFee) > 0) rows.push({ label: 'Card Fee (3.75%)', value: num(calc.cardFee) });
  if (num(calc.salesTax) > 0) rows.push({ label: 'Sales Tax (8.3%)', value: num(calc.salesTax) });
  if (num(calc.shipping) > 0) rows.push({ label: 'Shipping', value: num(calc.shipping) });
  if (num(calc.rushFee) > 0) rows.push({ label: 'Rush Fee', value: num(calc.rushFee) });
  rows.push({ label: 'TOTAL', value: total, isGrandTotal: true });
  return rows;
}

export function buildProjectDocumentModel(
  source: DocumentSource,
  mode: DocumentMode,
  opts: BuildOptions = {},
): ProjectDocumentModel {
  const visibility = getModeVisibility(mode);

  const rawItems: any[] = Array.isArray(source.lineItems)
    ? source.lineItems
    : Array.isArray(source.lineItemsData)
      ? source.lineItemsData
      : [];
  const lineItems = rawItems.map((li, i) => buildLineItem(li, i));
  const grandTotalQty = lineItems.reduce((sum, li) => sum + li.totalQty, 0);

  const documentNumber =
    mode === 'INVOICE'
      ? source.invoiceNumber || null
      : source.projectNumber || source.invoiceNumber || null;

  const secondaryDate =
    mode === 'INVOICE'
      ? formatDocDate(source.dueDate || source.inHandsDate)
      : formatDocDate(source.inHandsDate);

  const customer: DocCustomer = {
    name:
      opts.customer?.name ||
      source.personOrganization ||
      source.projectName ||
      source.title ||
      '—',
    addressLines: opts.customer?.addressLines ?? [],
    phone: opts.customer?.phone ?? null,
  };

  const notes = opts.notes || source.notesClient || source.notes || DEFAULT_DOC_NOTES;

  return {
    mode,
    visibility,
    documentNumber,
    date: formatDocDate(source.orderDate || source.createdAt),
    secondaryDate,
    projectName: source.projectName || source.title || '—',
    customer,
    notes,
    lineItems,
    grandTotalQty,
    totals: visibility.showPricing ? buildTotals(source.calculations) : [],
  };
}
