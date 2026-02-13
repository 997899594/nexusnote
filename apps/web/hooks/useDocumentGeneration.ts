/**
 * useDocumentGeneration - 文档生成 Hook
 *
 * 使用 AI SDK v6 的 useObject hook 实现流式结构化输出
 * 服务端使用 streamText + output.object() 流式返回 JSON，客户端实时解析为 partial object 并渐进渲染
 */

"use client";

import { experimental_useObject as useObject } from "@ai-sdk/react";
import { z } from "zod";
import { generateDocAction } from "@/app/actions/ai";

export interface Chapter {
  title: string;
  content: string;
  level: number;
}

export interface DocumentOutline {
  outline: Chapter[];
}

const ChapterSchema = z.object({
  title: z.string(),
  content: z.string(),
  level: z.number(),
});

const DocumentSchema = z.object({
  outline: z.array(ChapterSchema),
});

export function useDocumentGeneration() {
  const { submit, object, error, isLoading, stop, clear } = useObject({
    api: "/api/generate-doc",
    schema: DocumentSchema,
    // 架构师重构：将 fetch 替换为 Server Action
    fetch: async (_url, options) => {
      const body = JSON.parse(options?.body as string);
      return (await generateDocAction(body)) as Response;
    },
  });

  const generate = (options: { topic: string; depth?: "shallow" | "medium" | "deep" }) => {
    clear();
    submit({
      topic: options.topic,
      depth: options.depth || "medium",
    });
  };

  // useObject 返回的 object 是 DeepPartial<DocumentOutline>
  // outline 中的每个 chapter 的字段可能是 undefined（正在流式传入）
  const outline = (object?.outline ?? []) as Array<Partial<Chapter>>;

  return {
    generate,
    outline,
    isLoading,
    error: error?.message ?? null,
    stop,
    clear,
  };
}
