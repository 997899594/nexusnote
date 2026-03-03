/**
 * ToolResultRenderer - 工具调用结果渲染分发器
 *
 * 根据工具类型分发到对应的渲染组件
 */

import type { ToolUIPart } from "ai";
import { InterviewOptions } from "@/components/interview/InterviewOptions";
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
  onSendReply?: (text: string) => void;
  addToolOutput?: (params: { tool: string; toolCallId: string; output: unknown }) => Promise<void>;
  isStreaming?: boolean;
}

export function ToolResultRenderer({
  toolPart,
  onSendReply,
  addToolOutput,
  isStreaming,
}: ToolResultRendererProps) {
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

    case "checkCourseProgress": {
      const output = getOutput<"checkCourseProgress">(toolPart);
      return <GenericToolResult output={output} />;
    }

    // Outline tools - 大纲在左侧面板显示，对话区不显示
    case "updateOutline": {
      return null;
    }

    case "proposeOutline": {
      return null;
    }

    // Interview options - 选项按钮（流式结束后才显示）
    case "suggestOptions": {
      // 流式进行中不显示选项
      if (isStreaming) {
        return null;
      }
      const output = getOutput<"suggestOptions">(toolPart);
      if (!output?.success || !output.options) {
        return null;
      }
      return (
        <InterviewOptions
          options={output.options}
          onSelect={(option) => {
            // 选项点击 = 发送文字消息
            onSendReply?.(option);
          }}
        />
      );
    }

    // 内部工具 - 不显示给用户
    case "assessComplexity":
    case "createCourseProfile":
    case "updateProfile":
    case "confirmOutline": {
      return null;
    }

    default: {
      const output = toolPart.output;
      return <GenericToolResult output={output} />;
    }
  }
}
