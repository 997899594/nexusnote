export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    const keys = Object.keys(objectValue).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

export function normalizeStringList(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}
