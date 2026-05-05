export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function formatPhone(raw: string): string {
  const digits = normalizePhone(raw);
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw.trim();
}

export function formatPhoneInput(raw: string): string {
  const digits = normalizePhone(raw).slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function isValidPhone(raw: string): boolean {
  return normalizePhone(raw).length === 10;
}
