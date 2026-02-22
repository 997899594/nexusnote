"use server";

/**
 * Generative UI Actions
 *
 * 使用 AI SDK v6 实现 AI 工具调用和 UI 组件生成
 * 基于 ToolLoopAgent 和 createAgentUIStreamResponse
 *
 * 后续任务将实现:
 * - createUIMessageStream 用于流式 UI 消息
 * - @ai-sdk/react 的 useChat 和 useUIMessage 用于客户端
 */

import { tool } from "ai";
import { z } from "zod";

// ============ UI 组件数据类型 ============
// 这些数据将在客户端渲染为组件，Server Actions 返回结构化数据

/**
 * 天气卡片数据
 */
export interface WeatherCardData {
  type: "weather";
  city: string;
  temp: number;
  condition: string;
}

/**
 * 闪卡预览数据
 */
export interface FlashcardPreviewData {
  type: "flashcard";
  front: string;
  back: string;
}

/**
 * 笔记搜索结果数据
 */
export interface NotesSearchResultData {
  type: "notes-search";
  query: string;
  results: Array<{ id: string; title: string; excerpt: string }>;
}

/**
 * UI 组件渲染 props
 */
export type UIComponentProps =
  | WeatherCardData
  | FlashcardPreviewData
  | NotesSearchResultData;

// ============ 工具定义 ============

/**
 * 创建闪卡工具
 */
const CreateFlashcardSchema = z.object({
  front: z.string().describe("闪卡正面问题"),
  back: z.string().describe("闪卡背面答案"),
});

export const createFlashcardUI = tool({
  description: "根据用户输入创建闪卡，包含正面和背面内容",
  inputSchema: CreateFlashcardSchema,
  execute: async ({ front, back }) => {
    return {
      type: "flashcard" as const,
      front,
      back,
    } satisfies FlashcardPreviewData;
  },
});

/**
 * 搜索笔记工具
 */
const SearchNotesSchema = z.object({
  query: z.string().describe("搜索关键词"),
});

export const searchNotesUI = tool({
  description: "搜索用户的笔记",
  inputSchema: SearchNotesSchema,
  execute: async ({ query }) => {
    // TODO: 实际搜索逻辑
    const results = [
      {
        id: "1",
        title: "React Hooks 学习笔记",
        excerpt: "useState 和 useEffect 是最常用的 Hooks...",
      },
    ];
    return {
      type: "notes-search" as const,
      query,
      results,
    } satisfies NotesSearchResultData;
  },
});

/**
 * 获取天气工具（示例）
 */
const GetWeatherSchema = z.object({
  city: z.string().describe("城市名称，例如：北京、上海"),
});

export const getWeatherUI = tool({
  description: "获取指定城市的天气信息",
  inputSchema: GetWeatherSchema,
  execute: async ({ city }) => {
    // 模拟 API 调用
    // const weatherData = await fetchWeatherFromAPI(city);
    return {
      type: "weather" as const,
      city,
      temp: 25,
      condition: "晴朗",
    } satisfies WeatherCardData;
  },
});

// ============ UI 工具集合 ============

export const uiTools = {
  createFlashcard: createFlashcardUI,
  searchNotes: searchNotesUI,
  getWeather: getWeatherUI,
} as const;

// ============ 类型导出 ============

export type UITools = typeof uiTools;
