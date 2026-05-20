# Billing

NexusNote billing is intentionally small: entitlements are owned by NexusNote, and payment
providers are external adapters.

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
