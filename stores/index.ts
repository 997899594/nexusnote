/**
 * Zustand Stores 统一导出
 *
 * 全局状态管理 - 跨页面共享的状态
 */

// Chat 相关
export { useChatStore } from './chat';
export { usePendingChatStore } from './pending-chat';
export { useTransitionStore } from './transition';

// Auth 相关
export { useAuthStore } from './auth';

// Editor 相关
export { useEditorStore } from './editor';

// User Preferences (Personalization)
export { useUserPreferencesStore } from './user-preferences';
export { selectCurrentPersona, selectStyleMetrics, selectLearningStyle } from './user-preferences';
