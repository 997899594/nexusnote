export type ClipboardCopyResult = "copied" | "fallback" | "failed";

function canUseClipboardApi(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.clipboard?.writeText);
}

function copyWithTextareaFallback(text: string): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

export async function copyTextToClipboard(text: string): Promise<ClipboardCopyResult> {
  if (canUseClipboardApi()) {
    try {
      await navigator.clipboard.writeText(text);
      return "copied";
    } catch {
      // Fall through to the legacy textarea path for browsers that expose the API
      // but reject it outside a secure context or without clipboard permission.
    }
  }

  return copyWithTextareaFallback(text) ? "fallback" : "failed";
}
