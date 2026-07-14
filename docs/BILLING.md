# Billing

NexusNote billing is intentionally small: entitlements are owned by NexusNote, and payment
providers are external adapters.

## Capability policy

Authentication and paid capability access are separate concerns:

- `basic_chat` is available to every authenticated user.
- `course_generation` requires an active trial or Pro entitlement.
- `research` requires an active trial or Pro entitlement.
- Course interviews remain available without an entitlement, but external research is physically
  removed from the agent tool set and course persistence is blocked until access is active.

Capability checks live in `lib/billing/capability-policy.ts`. Routes and AI prompts must not invent
their own billing rules.

The product catalog used by pricing lives in `lib/billing/product-catalog.ts` and derives monetary
amounts from `lib/billing/plans.ts`. The public contract is:

- Free keeps basic authenticated chat, course interviews and outline revisions, public-course
  learning, note capture, and publication of courses the user already owns.
- Trial and Pro add course generation and external research.
- Rate limits protect service availability but are not monthly product quotas.
- Pricing copy must not advertise course-count, message-count, publication-count, or model-routing
  entitlements unless the same rule exists in the server capability policy.

## Processing contract

Paid webhook processing is an atomic database inbox operation. Event insertion, order locking,
amount validation, user locking, entitlement extension, and event completion happen in one
PostgreSQL transaction. Any failure rolls the event back so the payment provider can safely replay
it. Redeem-code counters and grants follow the same locking and transaction contract.

## Modes

### Redeem codes

Use this when there is no payment provider yet.

```bash
bun run billing:create-code --plan=pro_month
bun run billing:create-code --plan=pro_year --days=366
```

Give the generated code to the user after manual payment. The user redeems it in profile settings.

### External checkout

Configure an external payment page:

```bash
BILLING_PROVIDER=external
BILLING_CHECKOUT_BASE_URL=https://example.com/pay
BILLING_WEBHOOK_SECRET=replace-with-random-secret
```

`/api/billing/checkout` appends these query parameters to `BILLING_CHECKOUT_BASE_URL`:

- `order_id`
- `user_id`
- `plan`
- `amount_cents`
- `currency`
- `return_url`
- `signature`

The external provider should notify:

```txt
POST /api/billing/webhooks/external
X-Billing-Signature: <hmac-sha256-hex-of-raw-json-body>
```

Body:

```json
{
  "eventId": "provider-event-id",
  "orderId": "billing-order-uuid",
  "status": "paid",
  "amountCents": 1900,
  "providerOrderId": "optional-provider-order-id",
  "providerTransactionId": "optional-provider-transaction-id",
  "paidAt": "2026-05-20T12:00:00.000Z"
}
```

Only verified webhooks grant Pro entitlements. Frontend redirects or success pages do not unlock
access.

### 302Pay checkout

302Pay is the lowest-friction automatic checkout path for this project. NexusNote creates the
checkout through the 302Pay API, stores the returned `checkout_id`, then treats the 302Pay callback
only as a trigger to query the official checkout status before granting Pro.

```bash
BILLING_PROVIDER=302pay
BILLING_302PAY_API_KEY=sk-your-302pay-api-key
# Optional, defaults to https://api.302.ai
BILLING_302PAY_BASE_URL=https://api.302.ai
```

Checkout flow:

1. `POST /api/billing/checkout` creates a local `billing_orders` row.
2. NexusNote calls `POST https://api.302.ai/v1/checkout` with `amount`, `redirect_url`,
   `callback_url`, and `product_description`.
3. The user is redirected to the returned `checkout_url`.
4. 302Pay calls `/api/billing/webhooks/302pay` with `checkout_id`.
5. NexusNote calls `GET https://api.302.ai/v1/checkout?checkout_id=...` and grants Pro only when
   the returned status is paid/success/completed.

Run `bun run db:push` before trying checkout locally or in production.
