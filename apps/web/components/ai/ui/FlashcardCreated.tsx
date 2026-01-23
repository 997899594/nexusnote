'use client'

import { Brain, Check, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface FlashcardCreatedProps {
  count: number
  cards: Array<{
    id: string
    front: string
    back: string
  }>
}

export function FlashcardCreated({ count, cards }: FlashcardCreatedProps) {
  return (
    <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-xl p-4 my-2">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
          <Brain className="w-4 h-4 text-violet-600" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span className="font-medium text-gray-900">已创建 {count} 张闪卡</span>
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        {cards.slice(0, 3).map((card, i) => (
          <div key={card.id} className="bg-white rounded-lg p-3 border border-violet-100">
            <div className="text-sm text-gray-600 mb-1">问题 {i + 1}</div>
            <div className="text-gray-900 font-medium line-clamp-2">{card.front}</div>
          </div>
        ))}
        {cards.length > 3 && (
          <div className="text-sm text-gray-500 text-center">
            还有 {cards.length - 3} 张卡片...
          </div>
        )}
      </div>

      <Link
        href="/review"
        className="flex items-center justify-center gap-2 w-full py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition text-sm font-medium"
      >
        <span>前往复习</span>
        <ExternalLink className="w-3 h-3" />
      </Link>
    </div>
  )
}
