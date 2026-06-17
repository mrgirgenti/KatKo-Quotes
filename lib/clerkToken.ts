// Bridge so non-React modules (apiFetch in contexts) can obtain the current
// Clerk session token. A component inside <ClerkProvider> registers the getter
// (Clerk's useAuth().getToken) at runtime; before that it resolves to null.
type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter | null = null;

export function setClerkTokenGetter(fn: TokenGetter | null) {
  tokenGetter = fn;
}

export async function getClerkToken(): Promise<string | null> {
  if (!tokenGetter) return null;
  try {
    return await tokenGetter();
  } catch {
    return null;
  }
}
