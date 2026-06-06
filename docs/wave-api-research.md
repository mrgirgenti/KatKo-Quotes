# Wave Accounting API — Research Summary

**Date:** June 2026  
**Source:** developer.waveapps.com (official docs), live API schema  
**GraphQL Endpoint:** `https://gql.waveapps.com/graphql/public`  
**Developer Portal:** https://developer.waveapps.com/hc/en-us

---

## TL;DR Capability Matrix

| Capability | Available | Notes |
|---|---|---|
| Customer creation | ✅ Yes | `customerCreate` mutation |
| Invoice creation | ✅ Yes | `invoiceCreate` mutation |
| Invoice retrieval | ✅ Yes | `business.invoices` query, paginated |
| Invoice PDF URL | ✅ Yes | `pdfUrl` field on invoice object — direct link, no separate endpoint |
| Invoice status | ✅ Yes | `status` field: DRAFT, SAVED, OVERDUE, PARTIAL, PAID, UNPAID |
| Payment status | ✅ Yes | `amountDue`, `amountPaid` on invoice; also `status` |
| Webhooks | ✅ Yes | HTTPS POST to your endpoint; Pro account required |
| `invoice.paid` event | ✅ Yes | Fires when invoice is fully paid |
| `invoice.viewed` event | ✅ Yes | Fires when client opens invoice link |
| `invoice.overdue` event | ✅ Yes | Fires when due date passes unpaid |
| Invoice send (email) | ✅ Yes | `invoiceSend` mutation — sends via Wave's email system |
| Refresh tokens | ✅ Yes | Requires `offline_access` scope |
| Rate limits | ⚠️ Undisclosed | Tier-based; Wave does not publish exact limits |
| Invoice PDF download (binary) | ⚠️ Indirect | `pdfUrl` is a direct URL — fetch it server-side; not a dedicated API endpoint |
| Payment recording (manual) | ✅ Yes | `invoicePaymentRecordManual` mutation (AR module) |
| Full delete of invoice | ✅ Yes | `invoiceDelete` mutation (only on DRAFT status) |

---

## Authentication

### Two Supported Methods

#### 1. OAuth 2.0 (Production — required for multi-user apps)
```
Authorization endpoint:  https://api.waveapps.com/oauth2/authorize/
Token exchange endpoint: https://api.waveapps.com/oauth2/token/
```

**Flow:**
1. Redirect user to `https://api.waveapps.com/oauth2/authorize/?client_id=...&response_type=code&scope=...`
2. User grants permission; Wave redirects back with `?code=...`
3. POST to token endpoint with `code`, `client_id`, `client_secret`, `grant_type=authorization_code`
4. Receive `access_token` (expires ~2 hours) and `refresh_token` (long-lived, requires `offline_access` scope)
5. Use `Authorization: Bearer <access_token>` on all GraphQL requests

**Token refresh:**
```
POST https://api.waveapps.com/oauth2/token/
Body: grant_type=refresh_token&refresh_token=<token>&client_id=...&client_secret=...
```

#### 2. Full Access Token (Development / internal tools only)
- Created in Wave Developer Portal → Manage Applications
- Passed as `Authorization: Bearer <token>`
- Represents the creating user, same permissions as that user
- **Not for multi-tenant production use**

### Critical OAuth Constraint
> Users can only grant OAuth access to businesses with an **active Pro or Wave Advisor subscription**.  
> Free Wave accounts cannot be authorized via OAuth.

---

## OAuth Scopes

| Scope | Grants |
|---|---|
| `customer:read` | Read customers |
| `customer:write` | Create/update customers |
| `customer:*` | Full customer access |
| `invoice:read` | Read invoices |
| `invoice:write` | Create/update invoices |
| `invoice:send` | Send invoices via email |
| `invoice:*` | Full invoice access |
| `product:read` / `product:write` / `product:*` | Products/services |
| `account:read` / `account:write` | Chart of accounts |
| `business:read` | Read business info |
| `transaction:write` / `transaction:*` | Money transactions |
| `sales_tax:read` / `sales_tax:write` | Tax rates |
| `user:read` | Read user profile |
| `vendor:read` / `vendor:write` | Vendors |
| `offline_access` | Enable refresh tokens |

**Minimum for invoicing integration:** `customer:write invoice:* offline_access`

---

## Available Endpoints (GraphQL Queries)

All requests are HTTP POST to `https://gql.waveapps.com/graphql/public`.

### Queries (Read)

#### List + filter customers
```graphql
query {
  business(id: "<BUSINESS_ID>") {
    customers(page: 1, pageSize: 20, sort: [NAME_ASC]) {
      pageInfo { currentPage totalPages totalCount }
      edges {
        node { id name email address { city country { code } } currency { code } }
      }
    }
  }
}
```

#### Get customer by ID
```graphql
query {
  business(id: "<BUSINESS_ID>") {
    customer(id: "<CUSTOMER_ID>") {
      id name firstName lastName email
      address { addressLine1 city postalCode country { code name } }
      currency { code }
    }
  }
}
```

#### List invoices (paginated)
```graphql
query($businessId: ID!, $page: Int!, $pageSize: Int!) {
  business(id: $businessId) {
    invoices(page: $page, pageSize: $pageSize) {
      pageInfo { currentPage totalPages totalCount }
      edges {
        node {
          id
          createdAt
          modifiedAt
          pdfUrl         # Direct URL to PDF — fetch server-side
          viewUrl        # Shareable client-facing link
          status         # DRAFT | SAVED | OVERDUE | PARTIAL | PAID | UNPAID
          invoiceNumber
          invoiceDate
          dueDate
          customer { id name }
          currency { code }
          amountDue  { value currency { symbol } }
          amountPaid { value currency { symbol } }
          total      { value currency { symbol } }
          lastSentAt
          lastSentVia
          lastViewedAt   # Populated when client opens viewUrl
          items {
            description
            quantity
            price
            subtotal { value }
            total    { value }
            taxes { amount { value } salesTax { name } }
          }
        }
      }
    }
  }
}
```

#### List invoices by customer
```graphql
query {
  business(id: "<BUSINESS_ID>") {
    invoices(customerId: "<CUSTOMER_ID>", page: 1, pageSize: 20) {
      edges { node { id invoiceNumber status amountDue { value } } }
    }
  }
}
```

---

## Available Endpoints (GraphQL Mutations)

### Customer Creation
```graphql
mutation ($input: CustomerCreateInput!) {
  customerCreate(input: $input) {
    didSucceed
    inputErrors { code message path }
    customer {
      id name firstName lastName email
      address { addressLine1 city postalCode country { code } }
      currency { code }
    }
  }
}
```
```json
{
  "input": {
    "businessId": "<BUSINESS_ID>",
    "name": "Acme Corp",
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane@acme.com",
    "address": {
      "city": "Phoenix",
      "postalCode": "85001",
      "provinceCode": "US-AZ",
      "countryCode": "US"
    },
    "currency": "USD"
  }
}
```

### Customer Update (Patch)
```graphql
mutation ($input: CustomerPatchInput!) {
  customerPatch(input: $input) {
    didSucceed
    inputErrors { code message path }
    customer { id name email }
  }
}
```

### Invoice Creation
```graphql
mutation ($input: InvoiceCreateInput!) {
  invoiceCreate(input: $input) {
    didSucceed
    inputErrors { message code path }
    invoice {
      id
      pdfUrl       # Available immediately on creation
      viewUrl
      status
      invoiceNumber
      invoiceDate
      dueDate
      amountDue  { value currency { symbol } }
      amountPaid { value currency { symbol } }
      total      { value currency { symbol } }
      items { description quantity price total { value } }
    }
  }
}
```
```json
{
  "input": {
    "businessId": "<BUSINESS_ID>",
    "customerId": "<CUSTOMER_ID>",
    "invoiceDate": "2026-06-06",
    "dueDate": "2026-07-06",
    "memo": "Thank you for your business",
    "items": [
      {
        "productId": "<PRODUCT_ID>",
        "description": "Custom Apparel — 50 shirts",
        "quantity": 50,
        "price": 25.00,
        "taxes": [{ "salesTaxId": "<TAX_ID>" }]
      }
    ]
  }
}
```

### Invoice Update (Patch)
```graphql
mutation ($input: InvoicePatchInput!) {
  invoicePatch(input: $input) {
    didSucceed
    inputErrors { message path code }
    invoice { id invoiceNumber status }
  }
}
```

### Send Invoice (Email via Wave)
```graphql
mutation ($input: InvoiceSendInput!) {
  invoiceSend(input: $input) {
    didSucceed
    inputErrors { message code path }
  }
}
```
```json
{
  "input": {
    "invoiceId": "<INVOICE_ID>",
    "to": ["client@example.com"],
    "message": "Please find your invoice attached.",
    "attachPDF": true
  }
}
```
> Sending email requires `invoice:send` scope. This triggers Wave to email the client from Wave's own servers.

### Record Manual Payment
```graphql
mutation ($input: InvoicePaymentRecordManualInput!) {
  invoicePaymentRecordManual(input: $input) {
    didSucceed
    invoice { id status amountDue { value } amountPaid { value } }
  }
}
```

### Delete Invoice (Draft only)
```graphql
mutation ($input: InvoiceDeleteInput!) {
  invoiceDelete(input: $input) {
    didSucceed
    inputErrors { message code path }
  }
}
```

---

## Invoice PDF Retrieval

**There is no dedicated PDF download API endpoint.**

The `pdfUrl` field on an `Invoice` object is a **pre-signed, direct URL** to the PDF file. It is returned immediately on both `invoiceCreate` and in the `invoices` list query.

**Server-side fetch pattern:**
```ts
// Get pdfUrl from invoice query
const { pdfUrl } = invoice;

// Fetch PDF binary on your server (NOT client-side — requires Bearer token context)
const response = await fetch(pdfUrl, {
  headers: { Authorization: `Bearer ${accessToken}` }
});
const pdfBuffer = await response.arrayBuffer();
// Store or serve as needed
```

**Note:** The URL may expire. Re-query the invoice to get a fresh `pdfUrl` if you need to regenerate it.

---

## Invoice Status Values

| Status | Meaning |
|---|---|
| `DRAFT` | Not saved/approved; not visible to client |
| `SAVED` | Approved, not yet sent or past due |
| `UNPAID` | Sent but not paid |
| `PARTIAL` | Partially paid (`amountPaid > 0`, `amountDue > 0`) |
| `PAID` | Fully paid (`amountDue == 0`) |
| `OVERDUE` | Past `dueDate`, still has balance |

**Payment status** is derived from `status` + `amountDue` + `amountPaid`. There is no separate payment object in the API for Wave Payments; you track it via these invoice fields.

---

## Webhooks

### Overview
- **Delivery:** HTTPS POST to your registered endpoint
- **Format:** JSON
- **Signature verification:** HMAC-SHA256 via `x-wave-signature` header
- **Requirement:** Wave **Pro** account; endpoint must use valid CA-signed TLS 1.2+ cert

### Registration
Done in the Wave Developer Portal (UI-only, no API for webhook registration):
1. Create an Application in Developer Portal
2. Navigate to Webhooks → select your app
3. Paste your HTTPS endpoint URL
4. Check the event types to subscribe to

### Supported Invoice Webhook Events

| Event | Fires When | Scope Required |
|---|---|---|
| `invoice.approved` | Invoice is saved/approved | `invoice:read` or `invoice:*` |
| `invoice.sent` | Invoice is emailed to client | `invoice:read` or `invoice:*` |
| `invoice.viewed` | Client opens the invoice link | `invoice:read` or `invoice:*` |
| `invoice.paid` | Invoice is fully paid | `invoice:read` or `invoice:*` |
| `invoice.partially_paid` | Partial payment recorded | `invoice:read` or `invoice:*` |
| `invoice.overpaid` | Payment exceeds invoice total | `invoice:read` or `invoice:*` |
| `invoice.overdue` | `dueDate` passed with balance remaining | `invoice:read` or `invoice:*` |

### Webhook Payload Structure
```json
{
  "event_id": "uuid-here",
  "event_type": "invoice.paid",
  "business_id": "BIZ_ID",
  "data": {
    "invoice_id": "INV_ID",
    "customer_id": "CUST_ID",
    "currency_code": "USD",
    "amount_due": "0.00",
    "amount_paid": "1250.00",
    "total": "1250.00",
    "due_date": "2026-07-06"
  }
}
```

### Signature Verification
```ts
import crypto from 'crypto';

function verifyWaveWebhook(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return signature === digest;
}

// In your API route:
const sig = req.headers['x-wave-signature'] as string;
const valid = verifyWaveWebhook(rawBody, sig, process.env.WAVE_WEBHOOK_SECRET!);
if (!valid) return res.status(401).json({ error: 'Invalid signature' });
```

### Scope-Gating Gotcha
If users haven't granted the required scopes during OAuth, **Wave silently skips event delivery for those users** — no error, no retry. If you add new event subscriptions, you must re-request scopes and have users re-authorize.

---

## Sync Limitations

| Limitation | Detail |
|---|---|
| **Pro-only OAuth** | Users must have active Pro or Wave Advisor subscription to authorize your app. Free accounts cannot connect. |
| **No invoice PDF endpoint** | No `GET /invoice/:id/pdf` endpoint — only the `pdfUrl` field, which may expire |
| **No payment webhook granularity** | Webhooks fire at the invoice level, not per transaction line |
| **No bulk operations** | GraphQL mutations are one record at a time; no batch create |
| **Rate limits opaque** | Wave does not publicly document rate limit numbers; tier-based |
| **Webhook registration is UI-only** | No API to programmatically register webhooks; must use Developer Portal |
| **Webhook requires public HTTPS** | Cannot use localhost or self-signed certs for webhook endpoint |
| **Access token TTL: ~2 hours** | Must refresh proactively; requires `offline_access` scope for refresh tokens |
| **No `lastViewedAt` on creation** | `lastViewedAt` is `null` until client actually opens the invoice |
| **No delete on non-draft invoices** | Cannot delete SAVED, PAID, PARTIAL, or OVERDUE invoices |
| **Pagination only** | No cursor-based streaming; max pageSize is schema-defined (appears to be ≤100) |
| **Business ID required on all mutations** | Every write operation targets a specific Business; must be retrieved first |

---

## Recommended Architecture for Katalyst Ko

### Integration Model: Hybrid Push + Poll

```
Katalyst Ko App (Ko OS)
        │
        ├─── On quote → Paid (status change)
        │         └─── POST /api/wave/create-invoice
        │                   └─── Wave GraphQL: customerCreate (if new) → invoiceCreate → invoiceSend
        │
        ├─── Webhook receiver: POST /api/webhooks/wave
        │         ├─── invoice.paid           → mark project as paid, notify team
        │         ├─── invoice.partially_paid → update amountPaid in DB, flag partial
        │         ├─── invoice.overdue        → flag project overdue, trigger reminder flow
        │         └─── invoice.viewed         → update lastViewedAt in project record
        │
        └─── Scheduled poll (every 15–30 min, or on demand)
                  └─── GET /api/wave/sync?projectId=...
                            └─── Wave GraphQL: invoice by ID → sync status + amounts
```

### Token Storage
- Store `access_token` and `refresh_token` encrypted in DB (per-user or per-org)
- Proactively refresh before expiry; set a cron job every 90 minutes
- If refresh fails, mark the Wave connection as `disconnected` and surface a re-auth CTA in the UI

### Customer Sync Strategy
- On first invoice for an org, call `customerCreate` → store returned `waveCustomerId` on the `Organization` record
- Check `waveCustomerId` is set before any invoice mutation; create customer if missing
- Do not duplicate-create: always check for existing `waveCustomerId` first

### Invoice Sync Strategy
- Store `waveInvoiceId` and `waveInvoiceLink` (the `viewUrl`) on the `Project` or `Quote` record
- `pdfUrl` re-query as needed (can expire); do not cache long-term
- Trust webhooks as the primary signal; poll as fallback for missed events

### Webhook Endpoint Requirements
- Must be deployed (not localhost): use the Replit `.replit.app` domain or custom domain
- Must use valid TLS (Replit deployments satisfy this automatically)
- Respond `200 OK` within a few seconds; process asynchronously if needed
- Implement idempotency using `event_id` to handle Wave retries safely

---

## Quick Reference: Key URLs

| Resource | URL |
|---|---|
| GraphQL endpoint | `https://gql.waveapps.com/graphql/public` |
| OAuth authorize | `https://api.waveapps.com/oauth2/authorize/` |
| OAuth token | `https://api.waveapps.com/oauth2/token/` |
| Developer portal | https://developer.waveapps.com/hc/en-us |
| API reference | https://developer.waveapps.com/hc/en-us/articles/360019968212-API-Reference |
| OAuth guide | https://developer.waveapps.com/hc/en-us/articles/360019493652-OAuth-Guide |
| OAuth scopes | https://developer.waveapps.com/hc/en-us/articles/360032818132-OAuth-Scopes |
| Webhooks setup guide | https://developer.waveapps.com/hc/en-us/articles/47778664499220-Webhooks-Setup-Guide |
| API playground | https://developer.waveapps.com/hc/en-us/articles/360018937431-API-Playground |
