/**
 * Quiz Result UI Component
 *
 * 渲染 generateQuiz 工具生成的测验
 */
'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, ChevronDown, ChevronUp, Award } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Question {
  id: number
  type: 'multiple_choice' | 'true_false' | 'fill_blank'
  question: string
  options?: string[]
  answer: string | number
  explanation?: string
}

interface QuizResultProps {
  topic: string
  difficulty: string
  questions: Question[]
}

export function QuizResult({ topic, difficulty, questions }: QuizResultProps) {
  const [answers, setAnswers] = useState<Record<number, string | number>>({})
  const [showResults, setShowResults] = useState(false)
  const [expandedExplanation, setExpandedExplanation] = useState<number | null>(null)

  const handleAnswer = (questionId: number, answer: string | number) => {
    if (showResults) return
    setAnswers((prev) => ({ ...prev, [questionId]: answer }))
  }

  const checkAnswers = () => {
    setShowResults(true)
  }

  const resetQuiz = () => {
    setAnswers({})
    setShowResults(false)
    setExpandedExplanation(null)
  }

  const correctCount = questions.filter(
    (q) => answers[q.id]?.toString().toLowerCase() === q.answer.toString().toLowerCase()
  ).length

  const difficultyColors = {
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    hard: 'bg-red-100 text-red-700',
  }

  return (
    <div className="my-3 p-4 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 rounded-2xl border border-violet-200/50 dark:border-violet-800/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-sm">📝 {topic}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${difficultyColors[difficulty as keyof typeof difficultyColors] || difficultyColors.medium}`}>
              {difficulty === 'easy' ? '简单' : difficulty === 'hard' ? '困难' : '中等'}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {questions.length} 题
            </span>
          </div>
        </div>
        {showResults && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-2 bg-white dark:bg-neutral-800 px-3 py-1.5 rounded-full shadow-sm"
          >
            <Award className="w-4 h-4 text-amber-500" />
            <span className="font-bold text-sm">
              {correctCount}/{questions.length}
            </span>
          </motion.div>
        )}
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((q, idx) => (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white dark:bg-neutral-800 rounded-xl p-3 shadow-sm"
          >
            <div className="flex items-start gap-2 mb-2">
              <span className="text-xs font-bold text-violet-500 bg-violet-100 dark:bg-violet-900/50 px-2 py-0.5 rounded">
                {idx + 1}
              </span>
              <p className="text-sm flex-1">{q.question}</p>
              {showResults && (
                answers[q.id]?.toString().toLowerCase() === q.answer.toString().toLowerCase()
                  ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-500 shrink-0" />
              )}
            </div>

            {/* Multiple Choice */}
            {q.type === 'multiple_choice' && q.options && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {q.options.map((opt, optIdx) => {
                  const isSelected = answers[q.id] === optIdx
                  const isCorrect = showResults && optIdx === q.answer
                  const isWrong = showResults && isSelected && optIdx !== q.answer

                  return (
                    <button
                      key={optIdx}
                      onClick={() => handleAnswer(q.id, optIdx)}
                      disabled={showResults}
                      className={`text-left text-xs p-2 rounded-lg border transition-all ${
                        isCorrect
                          ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                          : isWrong
                            ? 'border-red-500 bg-red-50 dark:bg-red-950/30'
                            : isSelected
                              ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30'
                              : 'border-gray-200 dark:border-gray-700 hover:border-violet-300'
                      }`}
                    >
                      <span className="font-medium mr-1">{String.fromCharCode(65 + optIdx)}.</span>
                      {opt}
                    </button>
                  )
                })}
              </div>
            )}

            {/* True/False */}
            {q.type === 'true_false' && (
              <div className="flex gap-2 mt-2">
                {['true', 'false'].map((opt) => {
                  const isSelected = answers[q.id] === opt
                  const isCorrect = showResults && opt === q.answer
                  const isWrong = showResults && isSelected && opt !== q.answer

                  return (
                    <button
                      key={opt}
                      onClick={() => handleAnswer(q.id, opt)}
                      disabled={showResults}
                      className={`flex-1 text-xs py-2 rounded-lg border transition-all ${
                        isCorrect
                          ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                          : isWrong
                            ? 'border-red-500 bg-red-50 dark:bg-red-950/30'
                            : isSelected
                              ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30'
                              : 'border-gray-200 dark:border-gray-700 hover:border-violet-300'
                      }`}
                    >
                      {opt === 'true' ? '✓ 正确' : '✗ 错误'}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Fill Blank */}
            {q.type === 'fill_blank' && (
              <input
                type="text"
                placeholder="输入答案..."
                value={(answers[q.id] as string) || ''}
                onChange={(e) => handleAnswer(q.id, e.target.value)}
                disabled={showResults}
                className={`w-full mt-2 text-xs p-2 rounded-lg border ${
                  showResults
                    ? answers[q.id]?.toString().toLowerCase() === q.answer.toString().toLowerCase()
                      ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                      : 'border-red-500 bg-red-50 dark:bg-red-950/30'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              />
            )}

            {/* Explanation */}
            {showResults && q.explanation && (
              <div className="mt-2">
                <button
                  onClick={() => setExpandedExplanation(expandedExplanation === q.id ? null : q.id)}
                  className="text-[10px] text-muted-foreground flex items-center gap-1 hover:text-violet-500"
                >
                  {expandedExplanation === q.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  查看解析
                </button>
                <AnimatePresence>
                  {expandedExplanation === q.id && (
                    <motion.p
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="text-xs text-muted-foreground mt-1 pl-2 border-l-2 border-violet-300"
                    >
                      {q.explanation}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        {!showResults ? (
          <button
            onClick={checkAnswers}
            disabled={Object.keys(answers).length < questions.length}
            className="flex-1 py-2 bg-violet-500 text-white text-sm font-medium rounded-xl hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            提交答案
          </button>
        ) : (
          <button
            onClick={resetQuiz}
            className="flex-1 py-2 bg-gray-100 dark:bg-gray-800 text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            重新答题
          </button>
        )}
      </div>
    </div>
  )
}
