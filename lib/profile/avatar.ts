const READABLE_CHARACTER_PATTERN = /[A-Za-z\u4E00-\u9FFF]/;
const LATIN_CHARACTER_PATTERN = /[A-Za-z]/;
const PLACEHOLDER_DISPLAY_NAMES = new Set(["学习者", "用户", "新用户", "demo", "demo user"]);
const PLACEHOLDER_EMAIL_HANDLES = new Set(["demo", "test", "user"]);

function normalizeText(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function isPlaceholderName(value: string): boolean {
  return PLACEHOLDER_DISPLAY_NAMES.has(value.toLowerCase());
}

function isPlaceholderEmailHandle(value: string): boolean {
  return PLACEHOLDER_EMAIL_HANDLES.has(value.toLowerCase());
}

function isReadableCharacter(char: string): boolean {
  return READABLE_CHARACTER_PATTERN.test(char);
}

function toDisplayToken(token: string): string {
  if (!token) {
    return token;
  }

  return LATIN_CHARACTER_PATTERN.test(token[0] ?? "")
    ? `${token[0].toUpperCase()}${token.slice(1)}`
    : token;
}

function getReadableEmailHandle(email: string | null | undefined): string | null {
  const normalizedEmail = normalizeText(email);
  if (!normalizedEmail.includes("@")) {
    return null;
  }

  const localPart =
    normalizedEmail
      .split("@")[0]
      ?.replace(/[._-]+/g, " ")
      .trim() ?? "";
  if (!localPart || !READABLE_CHARACTER_PATTERN.test(localPart)) {
    return null;
  }

  const readableHandle = localPart.split(/\s+/).filter(Boolean).map(toDisplayToken).join(" ");
  return isPlaceholderEmailHandle(readableHandle) ? null : readableHandle;
}

function getReadableParts(value: string): string[] {
  return value
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => Array.from(part).some(isReadableCharacter));
}

function getReadableCharacters(value: string): string[] {
  return Array.from(value).filter(isReadableCharacter);
}

function formatAvatarCharacter(char: string): string {
  return LATIN_CHARACTER_PATTERN.test(char) ? char.toUpperCase() : char;
}

export function getProfileDisplayName(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  const trimmedName = normalizeText(name);
  if (trimmedName && !isPlaceholderName(trimmedName)) {
    return trimmedName;
  }

  return getReadableEmailHandle(email) ?? "我的账户";
}

export function getProfileAvatarLabel(
  name: string | null | undefined,
  email: string | null | undefined,
): string | null {
  const trimmedName = normalizeText(name);
  const source =
    trimmedName && !isPlaceholderName(trimmedName)
      ? trimmedName
      : getReadableEmailHandle(email) || "";
  if (!source) {
    return null;
  }

  const parts = getReadableParts(source);
  if (parts.length === 0) {
    return null;
  }

  if (parts.length === 1) {
    const readableCharacters = getReadableCharacters(parts[0]);
    if (readableCharacters.length === 0) {
      return null;
    }

    return readableCharacters.slice(0, 2).map(formatAvatarCharacter).join("");
  }

  return parts
    .map((part) => getReadableCharacters(part)[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .map(formatAvatarCharacter)
    .join("");
}
