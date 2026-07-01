/**
 * POS-terminal style decimal formatter.
 *
 * Rules (always 2 decimal places):
 *  1–2 raw digits  → treat as whole number: "2" → "2.00", "25" → "25.00"
 *  3+ raw digits   → last 2 digits are decimal: "234" → "2.34", "1250" → "12.50"
 *
 * This is the standard POS / payment-terminal behaviour where the user never
 * types a decimal point — it is always maintained automatically.
 */
export function formatPosDecimal(rawDigits: string): string {
  const d = rawDigits.replace(/\D/g, '');
  if (!d) return '0.00';
  if (d.length <= 2) {
    return `${parseInt(d, 10)}.00`;
  }
  const intPart = parseInt(d.slice(0, d.length - 2), 10);
  const decPart = d.slice(-2);
  return `${intPart}.${decPart}`;
}

/** Parse a raw-digits string to a float using POS decimal rules. */
export function parsePosDecimal(rawDigits: string): number {
  return parseFloat(formatPosDecimal(rawDigits)) || 0;
}

/**
 * Convert an existing float value to the raw-digits string needed by state.
 * e.g. 4.00 → '400', 12.50 → '1250', 0.03 → '003'
 */
export function floatToRawDigits(value: number): string {
  const cents = Math.round(value * 100);
  if (cents === 0) return '';
  return cents.toString().padStart(3, '0');
}

/**
 * True cash-register / banking style entry. Every digit fills from the
 * hundredths place and shifts left:
 *   '' → '0.00', '5' → '0.05', '53' → '0.53', '534' → '5.34', '5340' → '53.40'
 *
 * Unlike formatPosDecimal (whole-number for 1–2 digits), this is fully
 * consistent, so backspace correctly shifts the decimal right.
 */
export function formatCents(rawDigits: string): string {
  const d = rawDigits.replace(/\D/g, '');
  if (!d) return '0.00';
  const padded = d.padStart(3, '0');
  const intPart = parseInt(padded.slice(0, -2), 10);
  const decPart = padded.slice(-2);
  return `${intPart}.${decPart}`;
}

/** Parse a raw-digits string to a float using cents-accumulation rules. */
export function parseCents(rawDigits: string): number {
  return parseFloat(formatCents(rawDigits)) || 0;
}
