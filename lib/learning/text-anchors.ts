export interface TextAnchor {
  textContent: string;
  startOffset: number;
  endOffset: number;
}

export interface TextSelectionAnchor {
  anchor: TextAnchor;
  selectedText: string;
}

export interface TextHighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface TextAnchorHighlight {
  id: string;
  rects: TextHighlightRect[];
}

export interface AnchoredTextItem {
  id: string;
  anchor: TextAnchor;
  quotedText?: string;
}

function getRangeBoundaryOffset(container: HTMLElement, node: Node, offset: number): number | null {
  const range = document.createRange();
  range.selectNodeContents(container);

  try {
    range.setEnd(node, offset);
    return range.toString().length;
  } catch {
    return null;
  }
}

export function createSelectionAnchor(params: {
  selection: Selection | null;
  container: HTMLElement;
  contextRadius?: number;
}): TextSelectionAnchor | null {
  const { selection, container, contextRadius = 50 } = params;
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) {
    return null;
  }

  const selectedText = range.toString().trim();
  if (!selectedText) {
    return null;
  }

  const containerText = container.textContent ?? "";
  const rangeStart = getRangeBoundaryOffset(container, range.startContainer, range.startOffset);
  const selectedStart = rangeStart === null ? -1 : containerText.indexOf(selectedText, rangeStart);
  if (rangeStart === null || selectedStart < 0) {
    return null;
  }

  const contextStart = Math.max(0, selectedStart - contextRadius);
  const contextEnd = Math.min(
    containerText.length,
    selectedStart + selectedText.length + contextRadius,
  );

  return {
    selectedText,
    anchor: {
      textContent: containerText.slice(contextStart, contextEnd),
      startOffset: selectedStart - contextStart,
      endOffset: selectedStart - contextStart + selectedText.length,
    },
  };
}

export function findTextAnchorRange(
  container: HTMLElement,
  item: Pick<AnchoredTextItem, "anchor" | "quotedText">,
): Range | null {
  const text = container.textContent ?? "";
  const contextIndex = text.indexOf(item.anchor.textContent);
  const quoteIndex = item.quotedText ? text.indexOf(item.quotedText) : -1;

  const absoluteStart = contextIndex >= 0 ? contextIndex + item.anchor.startOffset : quoteIndex;
  const absoluteEnd =
    contextIndex >= 0
      ? contextIndex + item.anchor.endOffset
      : quoteIndex + (item.quotedText?.length ?? 0);

  if (absoluteStart < 0 || absoluteEnd <= absoluteStart) {
    return null;
  }

  const range = document.createRange();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let startSet = false;

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const nodeLength = node.length;

    if (!startSet && currentOffset + nodeLength > absoluteStart) {
      range.setStart(node, absoluteStart - currentOffset);
      startSet = true;
    }

    if (startSet && currentOffset + nodeLength >= absoluteEnd) {
      range.setEnd(node, absoluteEnd - currentOffset);
      return range;
    }

    currentOffset += nodeLength;
  }

  return null;
}

export function getTextAnchorHighlights(
  container: HTMLElement,
  items: AnchoredTextItem[],
): TextAnchorHighlight[] {
  const containerRect = container.getBoundingClientRect();

  return items.flatMap((item) => {
    const range = findTextAnchorRange(container, item);
    if (!range) {
      return [];
    }

    const rects = Array.from(range.getClientRects())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({
        top: rect.top - containerRect.top,
        left: rect.left - containerRect.left,
        width: rect.width,
        height: rect.height,
      }));

    if (rects.length === 0) {
      return [];
    }

    return [{ id: item.id, rects }];
  });
}
