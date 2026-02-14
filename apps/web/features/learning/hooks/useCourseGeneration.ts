import { useChat } from "@ai-sdk/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { saveCourseProfileAction } from "@/features/learning/actions/course";
import type { OutlineData } from "@/features/learning/agents/course-profile";
import type {
  InterviewAgentMessage,
  InterviewContext,
} from "@/features/learning/agents/interview/agent";
import type { CourseOutline as StoreCourseOutline } from "@/features/learning/stores/learning-store";
import { findToolCall } from "@/features/shared/ai/ui-utils";
import { learningStore } from "@/lib/storage";
import type { CourseNode } from "@/lib/types/course";

// ============================================
// Constants
// ============================================

const PHASE_TRANSITION_DELAYS = {
  synthesis: 1500,
  seeding: 1200,
  growing: 1000,
  ready: 1500,
  manifesting: 2500,
} as const;

const STORAGE_KEY = "nexusnote-course-gen-v1";
const STORAGE_KEY_PREFIX = "nexusnote-course-gen-";
const MAX_MESSAGES_TO_STORE = 50; // 限制存储的消息数量
const STORAGE_TTL = 24 * 60 * 60 * 1000; // 24小时过期

// --- Types ---

export type Phase =
  | "interview"
  | "synthesis"
  | "outline_review"
  | "seeding"
  | "growing"
  | "ready"
  | "manifesting";

interface Chapter {
  title: string;
  summary?: string;
  keyPoints?: string[];
  contentSnippet?: string;
}

interface Module {
  title: string;
  chapters: Chapter[];
}

interface CourseOutline {
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedMinutes: number;
  modules?: Module[];
  chapters?: Chapter[];
}

interface State {
  phase: Phase;
  goal: string;
  context: InterviewContext; // Use shared InterviewContext type
  nodes: CourseNode[];
  outline: CourseOutline | null;
  id?: string; // Unified ID
}

type Action =
  | { type: "SET_GOAL"; payload: string }
  | { type: "UPDATE_CONTEXT"; payload: Partial<InterviewContext> }
  | { type: "SET_NODES"; payload: CourseNode[] }
  | { type: "SET_OUTLINE"; payload: CourseOutline }
  | { type: "SET_ID"; payload: string }
  | { type: "TRANSITION"; payload: Phase }
  | { type: "RESTORE"; payload: Partial<State> }
  | {
      type: "UPDATE_NODE_STATUS";
      payload: { id: string; status: CourseNode["status"] };
    };

// --- Reducer ---

const initialState: State = {
  phase: "interview",
  goal: "",
  context: {
    goal: "",
    background: "",
    targetOutcome: "",
    cognitiveStyle: "",
  },
  nodes: [],
  outline: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_GOAL":
      return {
        ...state,
        goal: action.payload,
        context: { ...state.context, goal: action.payload },
      };
    case "UPDATE_CONTEXT":
      return { ...state, context: { ...state.context, ...action.payload } };
    case "SET_NODES":
      return { ...state, nodes: action.payload };
    case "SET_OUTLINE":
      return { ...state, outline: action.payload };
    case "SET_ID":
      return { ...state, id: action.payload };
    case "TRANSITION":
      return { ...state, phase: action.payload };
    case "RESTORE":
      return { ...state, ...action.payload };
    case "UPDATE_NODE_STATUS":
      return {
        ...state,
        nodes: state.nodes.map((n) =>
          n.id === action.payload.id ? { ...n, status: action.payload.status } : n,
        ),
      };
    default:
      return state;
  }
}

// ============================================
// Storage Helpers
// ============================================

/**
 * 清理过期的存储数据
 */
function cleanupExpiredStorage() {
  try {
    const now = Date.now();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        const data = localStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          // 检查是否过期
          if (parsed.timestamp && now - parsed.timestamp > STORAGE_TTL) {
            localStorage.removeItem(key);
            console.log(`[cleanup] Removed expired storage: ${key}`);
          }
        }
      }
    }
  } catch (err) {
    console.error("[cleanup] Failed to cleanup storage:", err);
  }
}

/**
 * 清理当前课程的存储（课程完成后调用）
 */
function clearCourseStorage(goal: string) {
  try {
    // 清理旧的通用存储键
    localStorage.removeItem(STORAGE_KEY);

    // 清理特定目标的存储键 (使用 encodeURIComponent 支持中文)
    const specificKey = `${STORAGE_KEY_PREFIX}${encodeURIComponent(goal)}`;
    localStorage.removeItem(specificKey);

    console.log("[storage] Cleared course storage for:", goal);
  } catch (err) {
    console.error("[storage] Failed to clear storage:", err);
  }
}

// --- Hook ---

export function useCourseGeneration(initialGoal: string = "", userId: string) {
  // 2026-02-09 修复：不要把 URL 的 goal 直接设为 context.goal
  // 用户可能输入任意文字（如测试的 "adad"），AI 需要先分析这是否是有效的学习目标
  // 初始 context 保持为空，让 AI 通过对话来确认用户的真实意图
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    goal: initialGoal || initialState.goal,
    context: initialState.context, // 不预设 goal，让 AI 分析
  });

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [createdCourseId, setCreatedCourseId] = useState<string | null>(null);
  const router = useRouter();

  // Manual Input State
  const [input, setInput] = useState("");

  // Prevent double-firing in Strict Mode
  const hasStartedRef = useRef(false);

  // Sync initial goal
  useEffect(() => {
    if (initialGoal !== state.goal) {
      dispatch({ type: "SET_GOAL", payload: initialGoal });
      hasStartedRef.current = false;
    }
  }, [initialGoal, state.goal]);

  // =========================================================
  // 2026 ARCHITECTURE: useChat + Tools
  // =========================================================
  // Updated for AI SDK React 3.0.69 / AI SDK 6.0+
  // - Server-side Tool Execution (Agentic)
  // - Client-side State Sync (via useEffect)
  // - status instead of isLoading

  const { messages, sendMessage, setMessages, status, error, regenerate, stop } =
    useChat<InterviewAgentMessage>();

  // Calculate isLoading from status
  const isLoading = status === "streaming" || status === "submitted";

  // Tool Invocation Handler (Sync Server Agent -> Client State)
  const processedToolCallIds = useRef<Set<string>>(new Set());

  // Auto-resume if last message is from user (e.g. after refresh)
  useEffect(() => {
    if (status !== "ready") return;

    const lastMessage = messages.at(-1);
    if (lastMessage?.role === "user") {
      regenerate({
        body: {
          explicitIntent: "INTERVIEW",
          interviewContext: state.context,
        },
      });
    }
  }, [status, messages, regenerate, state.context]);

  useEffect(() => {
    const lastMessage = messages.at(-1);
    if (lastMessage?.role !== "assistant") return;

    const toolCall = findToolCall<Record<string, unknown>, CourseOutline>(
      lastMessage,
      "generateOutline",
    );

    if (toolCall?.state === "output-available" && toolCall.output) {
      if (processedToolCallIds.current.has(toolCall.toolCallId)) return;

      console.log("[Tool Sync] Outline generated, updating state");
      processedToolCallIds.current.add(toolCall.toolCallId);

      const chapters =
        toolCall.output.chapters ?? toolCall.output.modules?.flatMap((m) => m.chapters) ?? [];

      const newNodes: CourseNode[] = chapters.map((ch, i) => ({
        id: `node-${i}`,
        title: ch.title,
        type: "chapter",
        x: Math.cos((i / chapters.length) * Math.PI * 2) * 280,
        y: Math.sin((i / chapters.length) * Math.PI * 2) * 280,
        status: "ready",
        depth: 1,
      }));

      dispatch({ type: "SET_OUTLINE", payload: toolCall.output });
      dispatch({ type: "SET_NODES", payload: newNodes });
      dispatch({ type: "TRANSITION", payload: "outline_review" });
    }
  }, [messages]);

  // Persistence: Load
  useEffect(() => {
    // 初始化时清理过期数据
    cleanupExpiredStorage();

    // 使用特定目标的键，避免多个课程互相覆盖 (使用 encodeURIComponent 支持中文)
    const specificKey = `${STORAGE_KEY_PREFIX}${encodeURIComponent(initialGoal)}`;
    const saved = localStorage.getItem(specificKey) || localStorage.getItem(STORAGE_KEY);

    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);

      // 检查是否过期
      if (parsed.timestamp && Date.now() - parsed.timestamp > STORAGE_TTL) {
        localStorage.removeItem(specificKey);
        return;
      }

      if (parsed.goal === initialGoal && parsed.messages?.length > 0) {
        console.log("[useCourseGeneration] Restoring state from storage");
        // 限制恢复的消息数量
        const limitedMessages = parsed.messages.slice(-MAX_MESSAGES_TO_STORE);
        setMessages(limitedMessages);
        dispatch({ type: "RESTORE", payload: parsed.state });
        hasStartedRef.current = true;
      }
    } catch (err) {
      console.error("[useCourseGeneration] Failed to parse saved state:", err);
      // 清理损坏的数据
      localStorage.removeItem(specificKey);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [initialGoal, setMessages]);

  // Persistence: Save
  useEffect(() => {
    if (!state.goal) return;

    // 限制存储的消息数量，避免 localStorage 溢出
    const limitedMessages = messages.slice(-MAX_MESSAGES_TO_STORE);

    const dataToStore = {
      goal: state.goal,
      state,
      messages: limitedMessages,
      timestamp: Date.now(), // 添加时间戳用于过期检查
    };

    try {
      // 使用特定目标的键 (使用 encodeURIComponent 支持中文)
      const specificKey = `${STORAGE_KEY_PREFIX}${encodeURIComponent(state.goal)}`;
      localStorage.setItem(specificKey, JSON.stringify(dataToStore));
    } catch (err) {
      if (err instanceof Error && err.name === "QuotaExceededError") {
        console.warn("[useCourseGeneration] Storage quota exceeded, clearing old data...");
        // 清理旧数据后重试
        cleanupExpiredStorage();
        localStorage.removeItem(STORAGE_KEY);
      } else {
        console.error("[useCourseGeneration] Failed to save state:", err);
      }
    }
  }, [state, messages]);

  // Phase ref
  const phaseRef = useRef(state.phase);
  useEffect(() => {
    phaseRef.current = state.phase;
  }, [state.phase]);

  const [isStarting, setIsStarting] = useState(false);

  // Auto-start
  useEffect(() => {
    if (messages.length > 0 || !state.goal || hasStartedRef.current) return;

    hasStartedRef.current = true;
    setIsStarting(true);

    sendMessage(
      { text: state.goal },
      {
        body: {
          explicitIntent: "INTERVIEW",
          interviewContext: state.context,
        },
      },
    );

    setIsStarting(false);
  }, [state.goal, messages.length, sendMessage, state.context]);

  // Handle Send Message
  const handleSendMessage = useCallback(
    async (
      e?: React.FormEvent,
      overrideInput?: string,
      contextUpdate?: Partial<InterviewContext>,
    ) => {
      e?.preventDefault();
      const text = overrideInput ?? input;
      if (!text.trim()) return;

      if (!overrideInput) setInput("");
      if (contextUpdate) dispatch({ type: "UPDATE_CONTEXT", payload: contextUpdate });

      const finalContext = contextUpdate ? { ...state.context, ...contextUpdate } : state.context;

      sendMessage(
        { text },
        {
          body: {
            explicitIntent: "INTERVIEW",
            interviewContext: finalContext,
          },
        },
      );
    },
    [input, state.context, sendMessage],
  );

  // Course Generation Logic
  const transitionProcessedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (state.phase !== "synthesis" || transitionProcessedRef.current.synthesis) return;

    transitionProcessedRef.current.synthesis = true;

    const runGenerationFlow = async () => {
      const data = state.outline!;
      const unifiedId = state.id || crypto.randomUUID();
      if (!state.id) dispatch({ type: "SET_ID", payload: unifiedId });

      const allChapters = data.chapters ?? data.modules?.flatMap((m) => m.chapters) ?? [];

      const storeOutline: StoreCourseOutline = {
        title: data.title,
        description: data.description,
        difficulty: data.difficulty,
        estimatedMinutes: data.estimatedMinutes,
        chapters: allChapters.map((ch) => ({
          title: ch.title,
          summary: ch.summary ?? ch.contentSnippet ?? "",
          keyPoints: ch.keyPoints ?? [],
        })),
      };

      const course = await learningStore.createFromOutline(storeOutline, "course", unifiedId);
      setCreatedCourseId(course.id);

      console.log(`[useCourseGeneration] 💾 Core profile sync: ${course.id}`);
      const result = await saveCourseProfileAction({
        id: course.id,
        goal: state.context.goal,
        background: state.context.background,
        targetOutcome: state.context.targetOutcome,
        cognitiveStyle: state.context.cognitiveStyle,
        outlineData: data as OutlineData,
        designReason: "AI 驱动的个性化学习路径",
      });

      if (!result.success) {
        throw new Error(`Critical: ${result.error}`);
      }

      // 启动后台预生成（非阻塞）
      console.log(`[useCourseGeneration] 🚀 Background generation: ${course.id}`);
      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              id: `gen-${Date.now()}`,
              role: "user",
              parts: [{ type: "text", text: "请生成第 1 章的内容。", state: "done" }],
            },
          ],
          explicitIntent: "COURSE_GENERATION",
          courseGenerationContext: {
            id: course.id,
            userId,
            goal: state.context.goal,
            background: state.context.background,
            targetOutcome: state.context.targetOutcome,
            cognitiveStyle: state.context.cognitiveStyle,
            outlineTitle: data.title,
            outlineData: data,
            moduleCount: data.modules?.length ?? 0,
            totalChapters: allChapters.length,
            currentModuleIndex: 0,
            currentChapterIndex: 0,
            chaptersGenerated: 0,
          },
        }),
      });

      const newNodes: CourseNode[] = allChapters.map((ch, i) => ({
        id: `node-${i}`,
        title: ch.title,
        type: "chapter",
        x: Math.cos((i / allChapters.length) * Math.PI * 2) * 280,
        y: Math.sin((i / allChapters.length) * Math.PI * 2) * 280,
        status: "ready",
        depth: 1,
      }));
      dispatch({ type: "SET_NODES", payload: newNodes });

      await new Promise((r) => setTimeout(r, PHASE_TRANSITION_DELAYS.synthesis));
      dispatch({ type: "TRANSITION", payload: "seeding" });
    };

    runGenerationFlow().catch((err) => {
      console.error("[useCourseGeneration] Flow interrupted:", err);
      dispatch({ type: "TRANSITION", payload: "seeding" });
    });
  }, [state.phase, state.outline, state.id, state.context, userId]);

  // Phase transition chain
  useEffect(() => {
    if (transitionProcessedRef.current[state.phase]) return;

    switch (state.phase) {
      case "seeding":
        transitionProcessedRef.current.seeding = true;
        setTimeout(
          () => dispatch({ type: "TRANSITION", payload: "growing" }),
          PHASE_TRANSITION_DELAYS.seeding,
        );
        break;
      case "growing":
        transitionProcessedRef.current.growing = true;
        setTimeout(
          () => dispatch({ type: "TRANSITION", payload: "ready" }),
          PHASE_TRANSITION_DELAYS.growing,
        );
        break;
      case "ready":
        transitionProcessedRef.current.ready = true;
        setTimeout(
          () => dispatch({ type: "TRANSITION", payload: "manifesting" }),
          PHASE_TRANSITION_DELAYS.ready,
        );
        break;
      case "manifesting":
        transitionProcessedRef.current.manifesting = true;
        // 课程完成后清理存储
        clearCourseStorage(state.goal);
        setTimeout(
          () => router.push(`/learn/${createdCourseId}`),
          PHASE_TRANSITION_DELAYS.manifesting,
        );
        break;
    }
  }, [state.phase, createdCourseId, router, state.goal]);

  const confirmOutline = (finalOutline: CourseOutline, id?: string) => {
    const unifiedId = id ?? state.id ?? crypto.randomUUID();
    if (unifiedId !== state.id) dispatch({ type: "SET_ID", payload: unifiedId });
    dispatch({ type: "SET_OUTLINE", payload: finalOutline });
    dispatch({ type: "TRANSITION", payload: "synthesis" });
  };

  return {
    state,
    ui: {
      userInput: input,
      setUserInput: setInput,
      isAiThinking: isLoading || isStarting,
      selectedNode,
      setSelectedNode,
      createdCourseId,
      messages,
      error: error?.message,
    },
    actions: {
      handleSendMessage,
      selectNode: setSelectedNode,
      confirmOutline,
      retry: () => (error ? regenerate() : sendMessage({ text: "继续" })),
      sendMessage,
      stop,
    },
  };
}
