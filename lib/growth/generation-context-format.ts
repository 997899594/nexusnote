export interface GrowthGenerationContext {
  currentDirection: {
    directionKey: string | null;
    title: string | null;
    summary: string | null;
    whyThisDirection: string | null;
  } | null;
  currentFocus: {
    nodeId: string | null;
    title: string | null;
    summary: string | null;
    state: string | null;
    progress: number | null;
  } | null;
  insights: Array<{
    kind: string;
    title: string;
    summary: string;
    confidence: number;
  }>;
}

interface FormatGrowthContextOptions {
  style?: "detailed" | "compact";
  emptyText?: string;
}

export function formatGrowthGenerationContext(
  context: GrowthGenerationContext | undefined,
  options: FormatGrowthContextOptions = {},
): string {
  const { style = "detailed", emptyText = "暂无成长上下文。" } = options;

  if (!context) {
    return emptyText;
  }

  const parts: string[] = [];

  if (context.currentDirection?.title) {
    if (style === "compact") {
      parts.push(
        `- 当前主方向：${context.currentDirection.title}${
          context.currentDirection.summary ? `（${context.currentDirection.summary}）` : ""
        }`,
      );
    } else {
      parts.push(
        `当前主方向：${context.currentDirection.title}${
          context.currentDirection.summary ? `\n方向摘要：${context.currentDirection.summary}` : ""
        }${
          context.currentDirection.whyThisDirection
            ? `\n推荐理由：${context.currentDirection.whyThisDirection}`
            : ""
        }`,
      );
    }
  }

  if (context.currentFocus?.title) {
    if (style === "compact") {
      parts.push(
        `- 当前焦点：${context.currentFocus.title}${
          context.currentFocus.summary ? `（${context.currentFocus.summary}）` : ""
        }${
          context.currentFocus.state
            ? `，状态 ${context.currentFocus.state}，进度 ${context.currentFocus.progress ?? 0}%`
            : ""
        }`,
      );
    } else {
      parts.push(
        `当前焦点：${context.currentFocus.title}${
          context.currentFocus.summary ? `\n焦点摘要：${context.currentFocus.summary}` : ""
        }${
          context.currentFocus.state
            ? `\n状态：${context.currentFocus.state} / 进度 ${context.currentFocus.progress ?? 0}%`
            : ""
        }`,
      );
    }
  }

  if (context.insights.length > 0) {
    if (style === "compact") {
      parts.push(
        `- 最近成长信号：${context.insights
          .map(
            (insight) =>
              `${insight.title}（${insight.kind}，${Math.round(insight.confidence * 100)}%）`,
          )
          .join("；")}`,
      );
    } else {
      parts.push(
        `最近成长信号：\n${context.insights
          .map(
            (insight) =>
              `- [${insight.kind}] ${insight.title} (${Math.round(insight.confidence * 100)}%)：${insight.summary}`,
          )
          .join("\n")}`,
      );
    }
  }

  return parts.length > 0 ? parts.join(style === "compact" ? "\n" : "\n\n") : emptyText;
}
