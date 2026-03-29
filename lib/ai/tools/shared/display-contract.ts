export type ToolUIPresentation = "chat" | "interview" | "hidden";

interface ToolUIDisplayPolicy {
  presentation: ToolUIPresentation;
}

const TOOL_UI_DISPLAY_POLICY = {
  mindMap: { presentation: "chat" },
  searchNotes: { presentation: "chat" },
  webSearch: { presentation: "chat" },
  summarize: { presentation: "chat" },
  editDocument: { presentation: "chat" },
  batchEdit: { presentation: "chat" },
  draftContent: { presentation: "chat" },
  getNote: { presentation: "chat" },
  createNote: { presentation: "chat" },
  updateNote: { presentation: "chat" },
  deleteNote: { presentation: "chat" },
  discoverSkills: { presentation: "chat" },
  presentOptions: { presentation: "interview" },
  presentOutlinePreview: { presentation: "interview" },
  hybridSearch: { presentation: "hidden" },
  loadLearnContext: { presentation: "hidden" },
  updateOutline: { presentation: "hidden" },
  proposeOutline: { presentation: "hidden" },
  assessComplexity: { presentation: "hidden" },
  createCourseProfile: { presentation: "hidden" },
} as const satisfies Record<string, ToolUIDisplayPolicy>;

export type RegisteredToolName = keyof typeof TOOL_UI_DISPLAY_POLICY;

export function getToolUIPresentation(toolName: string): ToolUIPresentation {
  return TOOL_UI_DISPLAY_POLICY[toolName as RegisteredToolName]?.presentation ?? "hidden";
}

export function isChatVisibleTool(toolName: string): boolean {
  return getToolUIPresentation(toolName) === "chat";
}

export function isInterviewVisibleTool(toolName: string): boolean {
  return getToolUIPresentation(toolName) === "interview";
}
