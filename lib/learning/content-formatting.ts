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
