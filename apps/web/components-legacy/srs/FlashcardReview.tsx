'use client'

import { useState, useEffect, useCallback } from 'react'
import { LocalFlashcard, ReviewRating } from '@/lib/storage/local-db'
import { flashcardStore, Rating, State } from '@/lib/storage/flashcard-store'

interface FlashcardReviewProps {
  cards: LocalFlashcard[]
  onComplete: () => void
  onCardReviewed?: (cardId: string, rating: ReviewRating) => void
}

export function FlashcardReview({ cards, onComplete, onCardReviewed }: FlashcardReviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [reviewStartTime, setReviewStartTime] = useState<number>(Date.now())
  const [isReviewing, setIsReviewing] = useState(false)

  const currentCard = cards[currentIndex]
  const progress = cards.length > 0 ? ((currentIndex) / cards.length) * 100 : 0

  useEffect(() => {
    setReviewStartTime(Date.now())
    setIsFlipped(false)
  }, [currentIndex])

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentCard) return

      if (e.code === 'Space') {
        e.preventDefault()
        setIsFlipped(f => !f)
      } else if (isFlipped) {
        switch (e.key) {
          case '1':
            handleRating(Rating.Again)
            break
          case '2':
            handleRating(Rating.Hard)
            break
          case '3':
            handleRating(Rating.Good)
            break
          case '4':
            handleRating(Rating.Easy)
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentCard, isFlipped])

  const handleRating = useCallback(async (rating: ReviewRating) => {
    if (!currentCard || isReviewing) return

    setIsReviewing(true)
    const duration = Date.now() - reviewStartTime

    try {
      await flashcardStore.reviewCard(currentCard.id, rating, duration)
      onCardReviewed?.(currentCard.id, rating)

      if (currentIndex < cards.length - 1) {
        setCurrentIndex(i => i + 1)
        setIsFlipped(false)
      } else {
        onComplete()
      }
    } finally {
      setIsReviewing(false)
    }
  }, [currentCard, currentIndex, cards.length, reviewStartTime, isReviewing, onCardReviewed, onComplete])

  if (!currentCard) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-xl font-medium text-gray-800">今日复习完成!</h2>
        <p className="mt-2 text-sm">明天再来继续学习</p>
      </div>
    )
  }

  const getStateLabel = (state: number) => {
    switch (state) {
      case State.New: return { text: '新卡片', color: 'bg-blue-100 text-blue-700' }
      case State.Learning: return { text: '学习中', color: 'bg-yellow-100 text-yellow-700' }
      case State.Review: return { text: '复习', color: 'bg-green-100 text-green-700' }
      case State.Relearning: return { text: '重学', color: 'bg-red-100 text-red-700' }
      default: return { text: '未知', color: 'bg-gray-100 text-gray-700' }
    }
  }

  const stateInfo = getStateLabel(currentCard.state)

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto p-4">
      {/* 进度条 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-500 mb-2">
          <span>{currentIndex + 1} / {cards.length}</span>
          <span className={`px-2 py-0.5 rounded text-xs ${stateInfo.color}`}>
            {stateInfo.text}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-violet-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 卡片 */}
      <div
        className="flex-1 cursor-pointer min-h-[300px]"
        onClick={() => setIsFlipped(f => !f)}
        style={{ perspective: '1000px' }}
      >
        <div
          className="relative w-full h-full transition-transform duration-500"
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* 正面 - 问题 */}
          <div
            className="absolute inset-0 bg-white border rounded-2xl p-8 flex flex-col shadow-lg"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xl text-gray-800 text-center whitespace-pre-wrap">{currentCard.front}</p>
            </div>
            {currentCard.context && (
              <div className="mt-4 pt-4 border-t text-sm text-gray-500">
                {currentCard.context}
              </div>
            )}
            <div className="mt-4 text-center text-sm text-gray-400">
              点击或按空格键翻转
            </div>
          </div>

          {/* 背面 - 答案 */}
          <div
            className="absolute inset-0 bg-white border rounded-2xl p-8 flex flex-col shadow-lg"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xl text-gray-800 text-center whitespace-pre-wrap">{currentCard.back}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 评分按钮 */}
      <div className={`mt-6 transition-opacity duration-200 ${isFlipped ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <p className="text-center text-sm text-gray-500 mb-4">你记得多清楚?</p>
        <div className="grid grid-cols-4 gap-3">
          <button
            onClick={() => handleRating(Rating.Again)}
            disabled={isReviewing}
            className="flex flex-col items-center p-4 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 transition disabled:opacity-50"
          >
            <span className="font-medium text-red-700">忘了</span>
            <span className="text-xs text-red-500 mt-1">1分钟</span>
            <span className="text-xs text-gray-400 mt-1">按 1</span>
          </button>
          <button
            onClick={() => handleRating(Rating.Hard)}
            disabled={isReviewing}
            className="flex flex-col items-center p-4 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 transition disabled:opacity-50"
          >
            <span className="font-medium text-orange-700">困难</span>
            <span className="text-xs text-orange-500 mt-1">~1天</span>
            <span className="text-xs text-gray-400 mt-1">按 2</span>
          </button>
          <button
            onClick={() => handleRating(Rating.Good)}
            disabled={isReviewing}
            className="flex flex-col items-center p-4 rounded-xl bg-green-50 hover:bg-green-100 border border-green-200 transition disabled:opacity-50"
          >
            <span className="font-medium text-green-700">记得</span>
            <span className="text-xs text-green-500 mt-1">~{Math.max(1, Math.round(currentCard.scheduledDays || 1))}天</span>
            <span className="text-xs text-gray-400 mt-1">按 3</span>
          </button>
          <button
            onClick={() => handleRating(Rating.Easy)}
            disabled={isReviewing}
            className="flex flex-col items-center p-4 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 transition disabled:opacity-50"
          >
            <span className="font-medium text-blue-700">简单</span>
            <span className="text-xs text-blue-500 mt-1">~{Math.max(1, Math.round((currentCard.scheduledDays || 1) * 1.5))}天</span>
            <span className="text-xs text-gray-400 mt-1">按 4</span>
          </button>
        </div>
      </div>
    </div>
  )
}
