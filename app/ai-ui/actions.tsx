"use server";

import { streamUI } from "@ai-sdk/rsc";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

// ============ Props 类型定义 ============

interface WeatherCardProps {
  city: string;
  temp: number;
  condition: string;
}

interface FlashcardPreviewProps {
  front: string;
  back: string;
}

interface NotesSearchResultProps {
  query: string;
  results: Array<{ id: string; title: string; excerpt: string }>;
}

// ============ React 组件 ============

function WeatherCard({ city, temp, condition }: WeatherCardProps) {
  return (
    <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
      <h3 className="font-semibold text-lg">{city} 天气</h3>
      <div className="flex items-center gap-4 mt-2">
        <span className="text-3xl font-bold">{temp}°C</span>
        <span className="text-gray-600 dark:text-gray-300">{condition}</span>
      </div>
    </div>
  );
}

function FlashcardPreview({ front, back }: FlashcardPreviewProps) {
  return (
    <div className="border rounded-lg p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 max-w-md">
      <div className="space-y-4">
        <div>
          <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">正面</span>
          <p className="font-medium mt-1">{front}</p>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700" />
        <div>
          <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">背面</span>
          <p className="mt-1">{back}</p>
        </div>
      </div>
    </div>
  );
}

function NotesSearchResult({ query, results }: NotesSearchResultProps) {
  return (
    <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
      <h3 className="font-semibold text-lg mb-3">搜索结果: "{query}"</h3>
      <ul className="space-y-3">
        {results.map((result) => (
          <li key={result.id} className="border-l-4 border-purple-500 pl-3">
            <h4 className="font-medium">{result.title}</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {result.excerpt}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============ Server Action ============

export async function generateAIResponse(userInput: string) {
  const result = await streamUI({
    model: openai("gpt-4o-mini"),
    prompt: userInput,
    text: ({ content }) => <div className="prose dark:prose-invert max-w-none">{content}</div>,
    tools: {
      createFlashcard: {
        description: "根据用户输入创建闪卡，包含正面和背面内容",
        inputSchema: z.object({
          front: z.string().describe("闪卡正面问题"),
          back: z.string().describe("闪卡背面答案"),
        }),
        generate: async function* ({ front, back }) {
          yield <div className="animate-pulse">正在创建闪卡...</div>;
          return <FlashcardPreview front={front} back={back} />;
        },
      },
      searchNotes: {
        description: "搜索用户的笔记",
        inputSchema: z.object({
          query: z.string().describe("搜索关键词"),
        }),
        generate: async function* ({ query }) {
          yield <div className="animate-pulse">搜索中...</div>;
          const results = [
            {
              id: "1",
              title: "React Hooks 学习笔记",
              excerpt: "useState 和 useEffect 是最常用的 Hooks...",
            },
          ];
          return <NotesSearchResult query={query} results={results} />;
        },
      },
      getWeather: {
        description: "获取指定城市的天气信息",
        inputSchema: z.object({
          city: z.string().describe("城市名称，例如：北京、上海"),
        }),
        generate: async function* ({ city }) {
          yield <div className="animate-pulse">正在获取 {city} 的天气...</div>;
          return <WeatherCard city={city} temp={25} condition="晴朗" />;
        },
      },
    },
  });

  return result.value;
}
