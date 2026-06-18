---
name: Clerk sign-in flow
description: Correct email+password sign-in sequence for Clerk "Identifier First" instances; token verification tolerance.
---

## The rule

Calling `signIn.create({ identifier, password })` on a Clerk instance configured with **Identifier First** flow returns `needs_first_factor` — not `complete` — even when the password is correct. You must then call `signIn.attemptFirstFactor({ strategy: 'password', password })` to complete the first factor, and only then might you get `complete` or `needs_second_factor`.

**Why:** Clerk separates identifier resolution from factor verification on newer/identifier-first instances. Passing both `identifier` and `password` in `create()` does NOT skip the second step.

**How to apply:**
Handle `needs_first_factor` everywhere a sign-in attempt result is inspected. The safe pattern is a recursive `advance(attempt)` helper:

```ts
const advance = async (attempt: any, pwd: string): Promise<void> => {
  switch (attempt.status) {
    case 'complete':
      await setActive({ session: attempt.createdSessionId });
      router.replace('/(tabs)');
      break;
    case 'needs_first_factor':
      const r = await signIn!.attemptFirstFactor({ strategy: 'password', password: pwd });
      await advance(r, pwd);
      break;
    case 'needs_second_factor':
      // show MFA UI
      break;
    default:
      setError(`Unexpected sign-in status: ${attempt.status}`);
  }
};
```

## Token verification clock skew

`verifyToken(token, { secretKey })` will throw "token used before issued" / "token expired" if the client's clock drifts even slightly behind the server. Always pass `clockSkewInMs: 5000` to tolerate up to 5 s of drift:

```ts
const claims = await verifyToken(token, { secretKey, clockSkewInMs: 5000 });
```

## MFA strategies

- `totp` and `backup_code` — no prepare call needed before `attemptSecondFactor`
- `email_code`, `phone_code` — call `signIn.prepareSecondFactor({ strategy })` first, then `attemptSecondFactor({ strategy, code })`

## Error message extraction

Clerk errors use `err?.errors?.[0]?.longMessage` OR `err?.errors?.[0]?.message`. Always try both:

```ts
function clerkMsg(err: any): string {
  return err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || String(err?.message || 'Unexpected error.');
}
```
