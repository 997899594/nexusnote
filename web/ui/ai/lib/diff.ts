/**
 * Diff utility - 文档比较
 */

export function diffLines(
  oldStr: string,
  newStr: string,
): Array<{ value: string; added?: boolean; removed?: boolean }> {
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");
  const result: Array<{ value: string; added?: boolean; removed?: boolean }> = [];

  let i = 0;
  let j = 0;

  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      result.push({ value: oldLines[i], added: false, removed: false });
      i++;
      j++;
    } else if (j < newLines.length && (!oldLines[i] || newLines[j] !== oldLines[i])) {
      result.push({ value: newLines[j], added: true });
      j++;
    } else if (i < oldLines.length) {
      result.push({ value: oldLines[i], removed: true });
      i++;
    }
  }

  return result;
}

export function diffWords(
  oldStr: string,
  newStr: string,
): Array<{ value: string; added?: boolean; removed?: boolean }> {
  const oldWords = oldStr.split(/\s+/);
  const newWords = newStr.split(/\s+/);
  const result: Array<{ value: string; added?: boolean; removed?: boolean }> = [];

  let i = 0;
  let j = 0;

  while (i < oldWords.length || j < newWords.length) {
    if (i < oldWords.length && j < newWords.length && oldWords[i] === newWords[j]) {
      result.push({ value: oldWords[i], added: false, removed: false });
      i++;
      j++;
    } else if (j < newWords.length) {
      result.push({ value: newWords[j], added: true });
      j++;
    } else if (i < oldWords.length) {
      result.push({ value: oldWords[i], removed: true });
      i++;
    }
  }

  return result;
}
