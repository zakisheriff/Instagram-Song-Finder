/**
 * Copies text with the async Clipboard API, falling back to a temporary
 * off-screen textarea where that API is missing or blocked.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or insecure context: try the legacy path below.
  }
  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  if (typeof document === "undefined") return false;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  // 16px keeps iOS from zooming if the element is focused, however briefly.
  textarea.style.cssText =
    "position:fixed;top:0;left:-9999px;opacity:0;font-size:16px;pointer-events:none;";
  document.body.appendChild(textarea);
  const previous = document.activeElement as HTMLElement | null;
  try {
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
    previous?.focus?.();
  }
}
