"use client";

/**
 * Flashcards Client Component
 *
 * 处理所有客户端交互：闪卡翻转、状态管理、动画
 */

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  category?: string;
  difficulty?: "easy" | "medium" | "hard";
}

interface FlashcardsClientProps {
  initialCards: Flashcard[];
}

export function FlashcardsClient({ initialCards }: FlashcardsClientProps) {
  const [cards] = useState<Flashcard[]>(initialCards);
  const [flippedIds, setFlippedIds] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentCard = cards[currentIndex];
  const isFlipped = flippedIds.has(currentCard?.id ?? "");

  const toggleFlip = () => {
    if (!currentCard) return;
    setFlippedIds((prev) => {
      const next = new Set(prev);
      if (next.has(currentCard.id)) {
        next.delete(currentCard.id);
      } else {
        next.add(currentCard.id);
      }
      return next;
    });
  };

  const goToNext = () => {
    setCurrentIndex((i) => Math.min(i + 1, cards.length - 1));
    setFlippedIds(new Set());
  };

  const goToPrev = () => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
    setFlippedIds(new Set());
  };

  if (cards.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-zinc-500 mb-4">还没有闪卡</p>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg">创建第一张闪卡</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* 进度指示 */}
        <div className="mb-6 flex items-center justify-between">
          <span className="text-sm text-zinc-500">
            {currentIndex + 1} / {cards.length}
          </span>
          <div className="flex gap-2">
            <button
              onClick={goToPrev}
              disabled={currentIndex === 0}
              className="px-3 py-1 text-sm bg-white border rounded-lg disabled:opacity-50"
            >
              上一张
            </button>
            <button
              onClick={goToNext}
              disabled={currentIndex === cards.length - 1}
              className="px-3 py-1 text-sm bg-white border rounded-lg disabled:opacity-50"
            >
              下一张
            </button>
          </div>
        </div>

        {/* 闪卡区域 */}
        <div className="relative h-80 perspective-1000">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentCard.id}-${isFlipped ? "back" : "front"}`}
              onClick={toggleFlip}
              className="absolute inset-0 cursor-pointer"
              initial={{ rotateY: 0 }}
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.6, type: "spring" }}
              style={{
                transformStyle: "preserve-3d",
                backfaceVisibility: "hidden",
              }}
            >
              <div className="absolute inset-0 bg-white rounded-2xl shadow-lg p-8 flex items-center justify-center">
                <p className="text-xl text-center font-medium">
                  {isFlipped ? currentCard.back : currentCard.front}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 操作提示 */}
        <p className="text-center text-sm text-zinc-400 mt-6">点击卡片查看答案</p>
      </div>
    </div>
  );
}
