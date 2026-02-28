/**
 * ToolResultRenderer - 工具调用结果渲染分发器
 *
 * 根据工具类型分发到对应的渲染组件
 */

import type { ToolUIPart } from "ai";
import { CourseOutlineCard } from "./CourseOutlineCard";
import { EditorConfirmDialog } from "./EditorConfirmDialog";
import { GenericToolResult } from "./GenericToolResult";
import { MindMapResult } from "./MindMapResult";
import { NoteLink } from "./NoteLink";
import { SearchResults } from "./SearchResults";
import { SummaryResult } from "./SummaryResult";
import type { ToolOutputMap } from "./types";

type ToolPart = ToolUIPart;

function getToolName(part: ToolPart): string {
  return part.type.replace("tool-", "");
}

function getOutput<T extends keyof ToolOutputMap>(part: ToolPart): ToolOutputMap[T] | undefined {
  return part.output as ToolOutputMap[T] | undefined;
}

interface ToolResultRendererProps {
  toolPart: ToolPart;
}

export function ToolResultRenderer({ toolPart }: ToolResultRendererProps) {
  if (toolPart.state !== "output-available") {
    return null;
  }

  const toolName = getToolName(toolPart);

  switch (toolName) {
    case "mindMap": {
      const output = getOutput<"mindMap">(toolPart);
      if (!output?.success || !output.mindMap) {
        return <GenericToolResult output={output} />;
      }
      return <MindMapResult output={output} />;
    }

    case "searchNotes":
    case "webSearch": {
      const output = getOutput<"searchNotes" | "webSearch">(toolPart);
      if (!output?.success) {
        return <GenericToolResult output={output} />;
      }
      return <SearchResults output={output} type={toolName} />;
    }

    case "summarize": {
      const output = getOutput<"summarize">(toolPart);
      if (!output?.success || !output.summary) {
        return <GenericToolResult output={output} />;
      }
      return <SummaryResult output={output} />;
    }

    case "editDocument":
    case "batchEdit":
    case "draftContent": {
      const output = getOutput<"editDocument" | "batchEdit" | "draftContent">(toolPart);
      if (!output) {
        return null;
      }
      return <EditorConfirmDialog output={output} toolName={toolName} />;
    }

    case "generateCourse": {
      const output = getOutput<"generateCourse">(toolPart);
      if (!output?.success) {
        return <GenericToolResult output={output} />;
      }
      return <CourseOutlineCard output={output} />;
    }

    case "getNote": {
      const output = getOutput<"getNote">(toolPart);
      if (!output?.success) {
        return <GenericToolResult output={output} />;
      }
      return <NoteLink output={output} type="view" />;
    }

    case "createNote": {
      const output = getOutput<"createNote">(toolPart);
      if (!output?.success) {
        return <GenericToolResult output={output} />;
      }
      return <NoteLink output={output} type="create" />;
    }

    case "updateNote":
    case "deleteNote": {
      const output = getOutput<"updateNote" | "deleteNote">(toolPart);
      return <GenericToolResult output={output} />;
    }

    case "discoverSkills": {
      const output = getOutput<"discoverSkills">(toolPart);
      return <GenericToolResult output={output} />;
    }

    case "analyzeStyle": {
      const output = getOutput<"analyzeStyle">(toolPart);
      return <GenericToolResult output={output} />;
    }

    case "checkCourseProgress": {
      const output = getOutput<"checkCourseProgress">(toolPart);
      return <GenericToolResult output={output} />;
    }

    default: {
      const output = toolPart.output;
      return <GenericToolResult output={output} />;
    }
  }
}
