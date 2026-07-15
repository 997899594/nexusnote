import type { z } from "zod";
import { badRequest } from "./errors";

export async function readBodyWithinLimit(request: Request, maxBytes: number): Promise<string> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw badRequest("请求内容过大", "REQUEST_BODY_TOO_LARGE");
  }

  if (!request.body) {
    throw badRequest("请求内容不能为空", "EMPTY_REQUEST_BODY");
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw badRequest("请求内容过大", "REQUEST_BODY_TOO_LARGE");
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
  } finally {
    reader.releaseLock();
  }

  return chunks.join("");
}

export async function parseUnknownJsonBodyWithinLimit(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const rawBody = await readBodyWithinLimit(request, maxBytes);

  try {
    return JSON.parse(rawBody);
  } catch {
    throw badRequest("无效的 JSON", "INVALID_JSON");
  }
}

export async function parseJsonBodyWithinLimit<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes: number,
): Promise<T> {
  return schema.parse(await parseUnknownJsonBodyWithinLimit(request, maxBytes));
}
