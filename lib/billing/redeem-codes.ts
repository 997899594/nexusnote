import { createHash } from "node:crypto";

export function normalizeRedeemCode(code: string): string {
  return code.trim().replaceAll("-", "").replaceAll(" ", "").toUpperCase();
}

export function hashRedeemCode(code: string): string {
  return createHash("sha256").update(normalizeRedeemCode(code)).digest("hex");
}
