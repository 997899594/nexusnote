export function getProfileAvatarLabel(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  const trimmedName = name?.trim();
  if (trimmedName) {
    return trimmedName
      .split(/\s+/)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  const emailInitial = email?.trim().charAt(0).toUpperCase();
  return emailInitial || "U";
}
