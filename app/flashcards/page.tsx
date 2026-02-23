/**
 * Flashcards Page - 2026 RSC Architecture
 *
 * Server Component: 获取闪卡数据
 * Client Component: 翻转动画、状态管理
 */

import { Suspense } from "react";
import { FlashcardsClient, type Flashcard } from "./FlashcardsClient";

// 模拟数据获取（实际应从 DB 获取）
async function getFlashcards(): Promise<Flashcard[]> {
  // TODO: 替换为真实数据库查询
  return [
    {
      id: "1",
      front: "什么是 React Server Component?",
      back: "React Server Component 是在服务端渲染的组件，可以直接访问数据库和后端 API，减少客户端 JavaScript 体积。",
      category: "React",
      difficulty: "medium",
    },
    {
      id: "2",
      front: "useState 和 useReducer 的区别是什么?",
      back: "useState 适合简单的独立状态，useReducer 适合复杂的状态逻辑，特别是当下一个状态依赖于前一个状态时。",
      category: "React",
      difficulty: "easy",
    },
    {
      id: "3",
      front: "解释 TypeScript 中的泛型",
      back: "泛型允许我们在定义函数、接口或类时不指定具体类型，而是在使用时指定类型，提供更好的类型复用性和类型安全。",
      category: "TypeScript",
      difficulty: "hard",
    },
  ];
}

export default async function FlashcardsPage() {
  // Server Component 直接获取数据
  const initialCards = await getFlashcards();

  return (
    <Suspense fallback={<FlashcardsSkeleton />}>
      <FlashcardsClient initialCards={initialCards} />
    </Suspense>
  );
}

function FlashcardsSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
