---
name: Email CTA URLs need an explicit scheme
description: Why links built from REPLIT_DEV_DOMAIN must be prefixed with https:// in outbound emails.
---

# Email CTA links must include the https:// scheme

`process.env.REPLIT_DEV_DOMAIN` is a bare host (e.g. `abc123.spock.replit.dev`)
with **no scheme**. Building an email link as `${REPLIT_DEV_DOMAIN}/quote/123`
produces a value the mail client treats as a **relative URL**, so the CTA button
resolves against the mail provider's domain (e.g. `mail.google.com/...`) and is
broken.

**Rule:** any URL placed in an outbound email body must be absolute —
`https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}` then append the
path. The good reference pattern lives in `app/quote/[id].tsx`.

**Why:** HTML `<a href>` without a scheme is relative; email clients have no base
URL pointing at this app, so the link goes nowhere useful.

**How to apply:** whenever you add an email builder caller (lib/email.ts takes
`adminUrl`/`portalUrl` as opts — the caller constructs them), prefix the scheme.

**Latent bug to watch:** `app/api/portal/submit+api.ts` still builds its email
URLs from a bare `REPLIT_DEV_DOMAIN` (no scheme) — same broken-link class, not
yet fixed.
