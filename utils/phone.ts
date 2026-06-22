/**
 * PHONE FORMAT LAW — site-wide.
 *
 * Every phone number, ANYWHERE it is shown (tables, forms, invoices/PDFs,
 * templates, portal) MUST render as `(###) ###-####`. No matter how it was
 * entered (`##########`, `###-###-####`, `1##########`, etc.), it auto-adjusts.
 *
 * - `formatPhone(raw)`         — display formatter (idempotent).
 * - `formatPhoneInput(raw)`    — live as-you-type formatter for TextInputs.
 * - `formatPhoneOrNull(raw)`   — server-side: format for storage, null-preserving.
 * - `normalizePhone(raw)`      — digits only.
 * - `isValidPhone(raw)`        — true when it resolves to a 10-digit US number.
 */

export function normalizePhone(raw?: string | null): string {
  return (raw ?? '').replace(/\D/g, '');
}

/** Drop a leading US country-code "1" so 1XXXXXXXXXX -> XXXXXXXXXX. */
function toTenDigits(digits: string): string {
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

export function formatPhone(raw?: string | null): string {
  if (!raw) return '';
  const digits = toTenDigits(normalizePhone(raw));
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return String(raw).trim();
}

export function formatPhoneInput(raw?: string | null): string {
  const digits = toTenDigits(normalizePhone(raw)).slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function isValidPhone(raw?: string | null): boolean {
  return toTenDigits(normalizePhone(raw)).length === 10;
}

/** Server/API convenience: format for storage, preserving null/empty as null. */
export function formatPhoneOrNull(raw?: string | null): string | null {
  if (raw == null) return null;
  const formatted = formatPhone(String(raw));
  return formatted.trim() ? formatted : null;
}
