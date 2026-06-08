import type { KeyboardEvent as ReactKeyboardEvent } from "react";

function isTextCompositionEvent(event: ReactKeyboardEvent<Element>): boolean {
  const nativeEvent = event.nativeEvent as KeyboardEvent & { keyCode?: number };
  return nativeEvent.isComposing || nativeEvent.keyCode === 229 || event.key === "Process";
}

export function shouldSubmitOnEnter(event: ReactKeyboardEvent<Element>): boolean {
  return event.key === "Enter" && !event.shiftKey && !isTextCompositionEvent(event);
}
