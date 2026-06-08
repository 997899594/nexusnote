import { createHash } from "node:crypto";

const MAX_JOB_ID_LENGTH = 180;
const FALLBACK_JOB_ID = "job";

function normalizeJobIdPart(part: string | number): string {
  return String(part).trim();
}

function sanitizeJobId(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9_-]+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

export function buildSafeJobId(parts: Array<string | number | null | undefined>): string {
  const raw = parts
    .filter((part): part is string | number => part !== null && part !== undefined)
    .map(normalizeJobIdPart)
    .filter(Boolean)
    .join("-");
  const sanitized = sanitizeJobId(raw);
  const base = sanitized || FALLBACK_JOB_ID;

  if (base.length <= MAX_JOB_ID_LENGTH) {
    return base;
  }

  const hash = createHash("sha256")
    .update(raw || base)
    .digest("hex")
    .slice(0, 16);
  return `${base.slice(0, MAX_JOB_ID_LENGTH - hash.length - 1)}-${hash}`;
}
