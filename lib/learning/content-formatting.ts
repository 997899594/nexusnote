function normalizeHeadingText(value: string): string {
  return value
    .replace(/^[\s#*\-`~]+/u, "")
    .replace(/^[\d.、\s]+/u, "")
    .replace(/[*_`]/gu, "")
    .replace(/[：:｜|\-—–]+/gu, " ")
    .replace(/\s+/gu, "")
    .toLowerCase();
}

export function stripLeadingSectionHeading(content: string, sectionTitle: string | null): string {
  if (!sectionTitle) {
    return content;
  }

  const trimmed = content.trimStart();
  const match = trimmed.match(/^#{1,3}\s+([^\n\r]+)(?:\r?\n|$)/u);
  if (!match?.[1]) {
    return content;
  }

  const heading = normalizeHeadingText(match[1]);
  const title = normalizeHeadingText(sectionTitle);
  if (!heading || !title) {
    return content;
  }

  if (heading.includes(title) || title.includes(heading)) {
    return trimmed.slice(match[0].length).trimStart();
  }

  return content;
}

/**
 * Strip numbering prefix from chapter/section titles.
 *
 * AI-generated chapter/section titles sometimes include numbering like
 * "1.1 引言" or "2. 逻辑回归". This function strips those prefixes so
 * only the semantic title text is displayed.
 *
 * Examples:
 *   "1.1 引言"      → "引言"
 *   "2. 逻辑回归"    → "逻辑回归"
 *   "1.1引言"        → "引言"
 *   "Introduction"   → "Introduction"  (no change)
 */
export function stripSectionNumber(title: string): string {
  return title.replace(/^\d+(?:\.\d+)*[\s.、]?\s*/u, "");
}
