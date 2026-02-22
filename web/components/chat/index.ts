/**
 * Chat Feature - Flat Export
 */

// Components
export { ChatHistory } from "./ChatHistory";
export { ChatLayout } from "./ChatLayout";
export { ChatMessage, LoadingDots } from "./ChatMessage";
export { ChatPanel } from "./ChatPanel";
export { CommandMenu } from "./CommandMenu";
export { TransitionOverlay } from "./TransitionOverlay";

// Hooks
export { useChatSession } from "./useChatSession";

// Stores
export { useChatStore } from "./useChatStore";
export { usePendingChatStore } from "./usePendingChatStore";
export { useTransitionStore } from "./useTransitionStore";

// Types (re-export from main types)
export type { Command } from "@/types/chat";
