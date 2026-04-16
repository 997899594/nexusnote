export interface ParsedSectionOutlineNodeKey {
  chapterIndex: number;
  chapterKey: string;
}

export function buildChapterOutlineNodeKey(chapterIndex: number): string {
  return `chapter-${chapterIndex + 1}`;
}

export function buildSectionOutlineNodeKey(chapterIndex: number, sectionIndex: number): string {
  return `section-${chapterIndex + 1}-${sectionIndex + 1}`;
}

export function parseSectionOutlineNodeKey(
  outlineNodeKey: string,
): ParsedSectionOutlineNodeKey | null {
  const match = /^section-(\d+)-\d+$/.exec(outlineNodeKey);
  if (!match) {
    return null;
  }

  const chapterNumber = Number(match[1]);
  if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
    return null;
  }

  return {
    chapterIndex: chapterNumber - 1,
    chapterKey: buildChapterOutlineNodeKey(chapterNumber - 1),
  };
}
