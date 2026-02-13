/**
 * learning 领域 — 课程生成、间隔重复学习、知识提取
 *
 * 公共 API：只导出外部领域需要的接口
 */

// 组件
export { ChatInterface } from "./components/create/ChatInterface";
export { FlashcardReview } from "./components/srs/FlashcardReview";

// 存储
export { flashcardStore } from "./stores/flashcard-store";
export { learningStore } from "./stores/learning-store";

// Agents
export { interviewAgent } from "./agents/interview/agent";
export { courseGenerationAgent } from "./agents/course-generation/agent";

// Actions
export { saveCourseProfileAction, getCourseChaptersAction } from "./actions/course";

// Hooks
export { useCourseGeneration } from "./hooks/useCourseGeneration";
export { useNoteExtraction } from "./hooks/use-note-extraction";
