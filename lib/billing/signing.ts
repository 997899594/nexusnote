import { createHmac, timingSafeEqual } from "node:crypto";

function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function signBillingPayload(secret: string, payload: string): string {
  return hmacSha256Hex(secret, payload);
}

export function verifyBillingSignature(params: {
  secret: string;
  payload: string;
  signature: string;
}): boolean {
  if (!params.secret || !params.signature) {
    return false;
  }

  const expected = signBillingPayload(params.secret, params.payload);
  const actualBuffer = Buffer.from(params.signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}
