const WHITESPACE_PATTERN = /\s+/g;

export function normalizeRagSearchText(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(WHITESPACE_PATTERN, " ");
}
