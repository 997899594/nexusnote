export function formatProfileActivityTime(updatedAt: Date | null): string {
  if (!updatedAt) {
    return "最近使用";
  }

  return new Date(updatedAt).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
