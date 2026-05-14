import { eq, isNull } from "drizzle-orm";

export function buildSourceVersionCondition<T>(
  field: T,
  sourceVersionHash: string | null | undefined,
) {
  if (sourceVersionHash === undefined) {
    return undefined;
  }

  return sourceVersionHash === null
    ? isNull(field as never)
    : eq(field as never, sourceVersionHash);
}
