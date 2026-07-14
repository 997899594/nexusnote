import crypto from "node:crypto";
import { z } from "zod";
import { env } from "@/config/env";
import { badRequest, serviceUnavailable } from "@/lib/api";

const PAYJS_BASE_URL = "https://payjs.cn/api";

const PayJSCheckoutSchema = z.object({
  return_code: z.number(),
  return_msg: z.string(),
  payjs_order_id: z.string().optional(),
  out_trade_no: z.string().optional(),
  qrcode: z.string().optional(),
  code_url: z.string().optional(),
  cashier_url: z.string().optional(),
});

const PayJSStatusSchema = z.object({
  return_code: z.number(),
  return_msg: z.string(),
  status: z.number().optional(),
});

export type PayJSStatus = z.infer<typeof PayJSStatusSchema>;

function sign(params: Record<string, string>, key: string): string {
  const sorted = Object.keys(params)
    .filter((k) => k !== "sign" && params[k] !== "" && params[k] !== undefined)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");

  return crypto.createHash("md5").update(`${sorted}&key=${key}`).digest("hex").toUpperCase();
}

function assertConfigured(): { mchId: string; key: string } {
  const mchId = env.BILLING_PAYJS_MCH_ID;
  const key = env.BILLING_PAYJS_KEY;

  if (!mchId || !key) {
    throw badRequest("PayJS is not configured", "BILLING_PAYJS_NOT_CONFIGURED");
  }

  return { mchId, key };
}

export function isPayJSPaidStatus(status: number): boolean {
  return status === 1;
}

export async function createPayJSCashierCheckout(params: {
  orderId: string;
  description: string;
  totalFee: number; // in cents
  callbackUrl: string;
}): Promise<{ payjsOrderId: string; cashierUrl: string }> {
  const { mchId, key } = assertConfigured();

  const formParams: Record<string, string> = {
    mchid: mchId,
    total_fee: String(params.totalFee),
    out_trade_no: params.orderId,
    body: params.description,
    notify_url: params.callbackUrl,
  };

  formParams.sign = sign(formParams, key);

  const response = await fetch(`${PAYJS_BASE_URL}/cashier`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(formParams).toString(),
  });

  if (!response.ok) {
    throw serviceUnavailable("PayJS 创建支付订单失败", "BILLING_PAYJS_CREATE_FAILED");
  }

  const data = PayJSCheckoutSchema.parse(await response.json());

  if (data.return_code !== 1) {
    throw serviceUnavailable(`PayJS 错误: ${data.return_msg}`, "BILLING_PAYJS_CREATE_FAILED");
  }

  if (!data.payjs_order_id || !data.cashier_url) {
    throw serviceUnavailable("PayJS 返回数据不完整", "BILLING_PAYJS_CREATE_FAILED");
  }

  return {
    payjsOrderId: data.payjs_order_id,
    cashierUrl: data.cashier_url,
  };
}

export async function getPayJSOrderStatus(payjsOrderId: string): Promise<PayJSStatus> {
  const { mchId, key } = assertConfigured();

  const queryParams: Record<string, string> = {
    mchid: mchId,
    payjs_order_id: payjsOrderId,
  };

  queryParams.sign = sign(queryParams, key);

  const url = new URL(`${PAYJS_BASE_URL}/check`);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(queryParams).toString(),
  });

  if (!response.ok) {
    throw serviceUnavailable("PayJS 查询订单状态失败", "BILLING_PAYJS_STATUS_FAILED");
  }

  return PayJSStatusSchema.parse(await response.json());
}

export function verifyPayJSSignature(params: Record<string, string>): boolean {
  if (!params.sign) return false;

  const { key } = assertConfigured();
  const expected = sign(params, key);

  const actualBuffer = Buffer.from(params.sign.toUpperCase());
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}
