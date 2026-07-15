import { z } from "zod";
import { env } from "@/config/env";
import { badRequest, serviceUnavailable } from "@/lib/api";

const Pay302CheckoutSchema = z.object({
  checkout_id: z.string().trim().min(1),
  checkout_url: z.string().url(),
  amount: z.number().optional(),
  status: z.string().optional(),
  created_at: z.string().optional(),
});

const Pay302CheckoutStatusSchema = z.object({
  checkout_id: z.string().trim().min(1),
  amount: z.number().optional(),
  status: z.string().trim().min(1),
  created_at: z.string().optional(),
});

export type Pay302CheckoutStatus = z.infer<typeof Pay302CheckoutStatusSchema>;

export function getPay302ApiKey(): string {
  return env.BILLING_302PAY_API_KEY || env.AI_302_API_KEY;
}

export function assertPay302Configured(): void {
  if (!getPay302ApiKey()) {
    throw badRequest("302Pay API key is not configured", "BILLING_302PAY_NOT_CONFIGURED");
  }
}

export function isPay302PaidStatus(status: string): boolean {
  return ["paid", "success", "succeeded", "completed", "complete"].includes(
    status.trim().toLowerCase(),
  );
}

export async function createPay302Checkout(params: {
  orderId: string;
  description: string;
  amountCents: number;
  redirectUrl: string;
  callbackUrl: string;
}) {
  assertPay302Configured();

  const response = await fetch(new URL("/v1/checkout", env.BILLING_302PAY_BASE_URL), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getPay302ApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Number((params.amountCents / 100).toFixed(2)),
      redirect_url: params.redirectUrl,
      callback_url: params.callbackUrl,
      product_description: params.description,
      metadata: {
        order_id: params.orderId,
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw serviceUnavailable("302Pay 创建支付订单失败", "BILLING_302PAY_CREATE_FAILED");
  }

  return Pay302CheckoutSchema.parse(await response.json());
}

export async function getPay302CheckoutStatus(checkoutId: string): Promise<Pay302CheckoutStatus> {
  assertPay302Configured();

  const url = new URL("/v1/checkout", env.BILLING_302PAY_BASE_URL);
  url.searchParams.set("checkout_id", checkoutId);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getPay302ApiKey()}`,
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw serviceUnavailable("302Pay 查询支付状态失败", "BILLING_302PAY_STATUS_FAILED");
  }

  return Pay302CheckoutStatusSchema.parse(await response.json());
}
