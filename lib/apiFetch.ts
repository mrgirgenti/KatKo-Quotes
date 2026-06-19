import { getClerkToken } from '@/lib/clerkToken';

/**
 * Auth-aware fetch for JSON API calls.
 * Attaches the Clerk session token as a Bearer header automatically.
 * Throws on non-2xx responses (same contract as the per-context apiFetch helpers).
 */
export async function apiFetch(path: string, opts?: RequestInit): Promise<any> {
  const token = await getClerkToken();
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `API error ${res.status}`);
  }
  return res.json();
}

/**
 * Returns an Authorization header object for use with non-JSON requests
 * (e.g. multipart/form-data file uploads where Content-Type must NOT be set
 * manually so the browser can add the correct multipart boundary).
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getClerkToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
