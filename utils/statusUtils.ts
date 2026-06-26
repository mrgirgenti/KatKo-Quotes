/**
 * Centralized status classification — single source of truth for
 * Quote vs Project status routing across the entire application.
 *
 * QUOTE statuses  — records that belong in "Submitted Quotes" sections,
 *                   quote dashboards, quote filters, and quote counts.
 *
 * PROJECT statuses — records that belong in "Active Projects", Production
 *                    Board, project dashboards, project filters, and counts.
 *
 * Business rule:
 *   Needs Review → Quoting → Quoted → Invoice Sent
 *   Once "Paid" is received the record is a PROJECT, never a quote again.
 */

export const QUOTE_STATUSES = [
  'draft',
  'needs_review',
  'quoting',
  'quoted',
  'invoice_sent',
  'expired',
] as const;

export const PROJECT_STATUSES = [
  'paid',
  'active',
  'production_started',
  'completed',
] as const;

export type QuoteFrontendStatus = typeof QUOTE_STATUSES[number];
export type ProjectFrontendStatus = typeof PROJECT_STATUSES[number];

/** Returns true when status belongs to the quote workflow (pre-payment). */
export function isQuoteStatus(status: string): boolean {
  return (QUOTE_STATUSES as readonly string[]).includes(status);
}

/** Returns true when status belongs to the project workflow (post-payment). */
export function isProjectStatus(status: string): boolean {
  return (PROJECT_STATUSES as readonly string[]).includes(status);
}
