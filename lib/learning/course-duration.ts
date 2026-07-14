const HAN_CHARACTERS_PER_MINUTE = 400;
const LATIN_WORDS_PER_MINUTE = 220;

export function estimateReadingMinutes(documents: string[]): number | null {
  if (documents.length === 0 || documents.some((document) => !document.trim())) return null;

  return documents.reduce((total, document) => {
    const hanCharacters = document.match(/\p{Script=Han}/gu)?.length ?? 0;
    const latinWords = document.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/gu)?.length ?? 0;
    const minutes = Math.ceil(
      hanCharacters / HAN_CHARACTERS_PER_MINUTE + latinWords / LATIN_WORDS_PER_MINUTE,
    );
    return total + Math.max(1, minutes);
  }, 0);
}
