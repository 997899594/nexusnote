'use client'

import { useCompletion } from '@ai-sdk/react'
import { useCallback } from 'react'
import { editorCompletionAction } from '@/app/actions/ai'

export type AIAction =
  | 'continue'
  | 'improve'
  | 'shorter'
  | 'longer'
  | 'translate_en'
  | 'translate_zh'
  | 'fix'
  | 'explain'
  | 'summarize'

export const AI_ACTIONS: Record<AIAction, { label: string; icon: string }> = {
  continue: { label: 'Continue writing', icon: '...' },
  improve: { label: 'Improve writing', icon: '*' },
  shorter: { label: 'Make shorter', icon: '-' },
  longer: { label: 'Make longer', icon: '+' },
  translate_en: { label: 'Translate to English', icon: 'EN' },
  translate_zh: { label: 'Translate to Chinese', icon: 'ZH' },
  fix: { label: 'Fix grammar', icon: '#' },
  explain: { label: 'Explain', icon: '?' },
  summarize: { label: 'Summarize', icon: '=' },
}

export function useInlineAI() {
  const {
    completion,
    complete,
    isLoading,
    stop,
    error,
    setCompletion,
  } = useCompletion({
    id: 'inline-ai',
    // 架构师重构：将 fetch 替换为 Server Action
    fetch: async (url, options) => {
      const body = JSON.parse(options?.body as string);
      return (await editorCompletionAction(body)) as Response;
    },
  })

  const runAction = useCallback(async (action: AIAction, selection: string) => {
    return complete(selection, {
      body: { action, selection },
    })
  }, [complete])

  const reset = useCallback(() => {
    setCompletion('')
  }, [setCompletion])

  return {
    completion,
    isLoading,
    error,
    stop,
    reset,
    runAction,
    // 便捷方法
    improve: (text: string) => runAction('improve', text),
    shorter: (text: string) => runAction('shorter', text),
    longer: (text: string) => runAction('longer', text),
    continueWriting: (text: string) => runAction('continue', text),
    translateToEnglish: (text: string) => runAction('translate_en', text),
    translateToChinese: (text: string) => runAction('translate_zh', text),
    fixGrammar: (text: string) => runAction('fix', text),
    explain: (text: string) => runAction('explain', text),
    summarize: (text: string) => runAction('summarize', text),
  }
}
