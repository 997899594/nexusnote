import { useChat } from "@ai-sdk/react";
import type { UIMessageChunk } from "ai";
import { useSession } from "next-auth/react";
import { aiGatewayAction } from "@/app/actions/ai";
import { type AIRequest } from "@/lib/ai/gateway/service";
import { useState, useReducer, useEffect, useRef, useCallback } from "react";
import { CourseNode } from "@/lib/types/course";
import { useRouter } from "next/navigation";
import { learningStore } from "@/lib/storage";
import type { CourseOutline as StoreCourseOutline } from "@/lib/storage/learning-store";
import { saveCourseProfileAction } from "@/app/actions/course";
import type {
  InterviewAgentMessage,
  InterviewContext,
} from "@/lib/ai/agents/interview/agent";
import { findToolCall } from "@/lib/ai/ui-utils";

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
    goal: undefined,
    background: undefined,
    targetOutcome: undefined,
    cognitiveStyle: undefined,
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
          n.id === action.payload.id
            ? { ...n, status: action.payload.status }
            : n,
        ),
      };
    default:
      return state;
  }
}

// --- Hook ---

export function useCourseGeneration(initialGoal: string = "") {
  const { data: session } = useSession();
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    goal: initialGoal || initialState.goal,
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
    if (initialGoal && initialGoal !== state.goal) {
      dispatch({ type: "SET_GOAL", payload: initialGoal });
      hasStartedRef.current = false;
    }
  }, [initialGoal]);

  // =========================================================
  // 2026 ARCHITECTURE: useChat + Tools
  // =========================================================
  // Updated for AI SDK React 3.0.69 / AI SDK 6.0+
  // - Server-side Tool Execution (Agentic)
  // - Client-side State Sync (via useEffect)
  // - status instead of isLoading

  const {
    messages,
    sendMessage,
    setMessages,
    status,
    error,
    regenerate,
    stop,
  } = useChat<InterviewAgentMessage>({
    id: "course-generation",
    transport: {
      sendMessages: async ({ messages, body }) => {
        const response = (await aiGatewayAction({
          messages,
          context: body as AIRequest["context"],
        })) as unknown as Response;

        if (!response.body) {
          throw new Error("No response body");
        }

        return response.body as unknown as ReadableStream<
          UIMessageChunk<InterviewAgentMessage>
        >;
      },
      reconnectToStream: async () => {
        throw new Error("Reconnection not supported");
      },
    },
  });

  // Calculate isLoading from status
  const isLoading = status === "streaming" || status === "submitted";

  // Tool Invocation Handler (Sync Server Agent -> Client State)
  const processedToolCallIds = useRef<Set<string>>(new Set());

  // Handle auto-resume if last message is from user (e.g. after refresh)
  useEffect(() => {
    // Only resume if we are ready and NOT currently streaming/submitting
    if (status !== "ready") return;

    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      // Only resume if the LAST message was from the user (waiting for AI reply)
      if (lastMessage.role === "user") {
        regenerate({
          body: {
            explicitIntent: "INTERVIEW",
            interviewContext: state.context,
            isInInterview: true,
          },
        });
      }
    }
  }, [status, messages, regenerate, state.context]);

  useEffect(() => {
    if (!messages || messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "assistant") return;

    // AI SDK v6 Agent UI: 使用统一工具函数提取大纲生成结果（类型安全）
    const toolCall = findToolCall<Record<string, unknown>, CourseOutline>(
      lastMessage,
      "generateOutline",
    );

    if (toolCall && toolCall.state === "output-available" && toolCall.output) {
      const toolCallId = toolCall.toolCallId;
      if (processedToolCallIds.current.has(toolCallId)) return;

      console.log("[Tool Sync] Outline generated, updating state");
      processedToolCallIds.current.add(toolCallId);

      const outlineData = toolCall.output;
      dispatch({ type: "SET_OUTLINE", payload: outlineData });

      // 同步更新节点数据
      const chapters =
        outlineData.chapters ??
        outlineData.modules?.flatMap((m) => m.chapters) ??
        [];

      const newNodes: CourseNode[] = chapters.map((ch, i) => ({
        id: `node-${i}`,
        title: ch.title,
        type: "chapter",
        x: Math.cos((i / chapters.length) * Math.PI * 2) * 280,
        y: Math.sin((i / chapters.length) * Math.PI * 2) * 280,
        status: "ready",
        depth: 1,
      }));

      dispatch({ type: "SET_NODES", payload: newNodes });
      dispatch({ type: "TRANSITION", payload: "outline_review" });
    }
  }, [messages]);

  // Persistence: Load
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.goal === initialGoal && parsed.messages?.length > 0) {
          console.log("[useCourseGeneration] Restoring state from storage");
          setMessages(parsed.messages);
          dispatch({ type: "RESTORE", payload: parsed.state });
          hasStartedRef.current = true;
        }
      }
    } catch (e) {
      console.error("Failed to load state", e);
    }
  }, [initialGoal, setMessages]);

  // Persistence: Save
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!state.goal) return;

    const data = {
      goal: state.goal,
      state: state,
      messages: messages,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [state, messages]);

  // Phase ref
  const phaseRef = useRef(state.phase);
  useEffect(() => {
    phaseRef.current = state.phase;
  }, [state.phase]);

  const [isStarting, setIsStarting] = useState(false);

  // Auto-start
  useEffect(() => {
    if (messages.length > 0 || !state.goal || hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;
    setIsStarting(true);

    // Initial message to kickstart the AI
    sendMessage(
      {
        text: state.goal,
      },
      {
        body: {
          explicitIntent: "INTERVIEW",
          interviewContext: state.context,
          isInInterview: true,
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
      if (e) e.preventDefault();
      const text = overrideInput ?? input;
      if (!text.trim()) return;

      if (!overrideInput) setInput("");

      // 如果提供了 contextUpdate，计算最新 context（同步）
      const finalContext = contextUpdate
        ? { ...state.context, ...contextUpdate }
        : state.context;

      console.log("[handleSendMessage] Sending message:", text);
      console.log("[handleSendMessage] contextUpdate:", contextUpdate);
      console.log("[handleSendMessage] state.context:", state.context);
      console.log(
        "[handleSendMessage] finalContext (will be sent):",
        finalContext,
      );

      // 同步更新本地 state（React 可能延迟，但我们不依赖它）
      if (contextUpdate) {
        dispatch({ type: "UPDATE_CONTEXT", payload: contextUpdate });
      }

      sendMessage(
        {
          text: text,
        },
        {
          body: {
            explicitIntent: "INTERVIEW",
            interviewContext: finalContext, // ← 保证使用计算出的最新值
            isInInterview: true,
          },
        },
      );
    },
    [input, state.context, sendMessage],
  );

  // Course Generation Logic (The "Backend" Simulation)
  // 架构师系统级重构：将基于定时器的不确定流转，改为确定性的异步序列流转
  const transitionProcessedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    // 只有在 synthesis 阶段且尚未处理过该阶段时执行
    if (
      state.phase === "synthesis" &&
      !transitionProcessedRef.current["synthesis"]
    ) {
      transitionProcessedRef.current["synthesis"] = true;

      const runGenerationFlow = async () => {
        try {
          if (!state.outline) {
            console.error("No outline available for course generation");
            return;
          }

          const data = state.outline;
          const unifiedId = state.id || crypto.randomUUID();

          if (!state.id) {
            dispatch({ type: "SET_ID", payload: unifiedId });
          }

          // 1. 本地存储同步
          const allChapters: Chapter[] =
            data.chapters ||
            (data.modules ? data.modules.flatMap((m) => m.chapters) : []);

          const storeOutline: StoreCourseOutline = {
            title: data.title,
            description: data.description,
            difficulty: data.difficulty,
            estimatedMinutes: data.estimatedMinutes,
            chapters: allChapters.map((ch) => ({
              title: ch.title,
              summary: ch.summary || ch.contentSnippet || "",
              keyPoints: ch.keyPoints || [],
            })),
          };

          const course = await learningStore.createFromOutline(
            storeOutline,
            "course",
            unifiedId,
          );
          setCreatedCourseId(course.id);

          // 2. 服务端画像同步（使用 Server Action 替代 fetch）
          console.log(
            `[useCourseGeneration] 💾 核心画像同步 (Server Action): ${course.id}`,
          );
          const result = await saveCourseProfileAction({
            id: course.id,
            goal: state.context.goal || "",
            background: state.context.background || "",
            targetOutcome: state.context.targetOutcome || "",
            cognitiveStyle: state.context.cognitiveStyle || "",
            outlineData: data,
            designReason: "AI 驱动的个性化学习路径",
          });

          if (!result.success) {
            throw new Error(`Critical: ${result.error}`);
          }

          // 3. 启动后台预生成（非阻塞）
          console.log(
            `[useCourseGeneration] 🚀 启动首章节预生成: ${course.id}`,
          );
          // 架构师重构：改用 Server Action 触发后台任务，实现全链路类型安全
          // 注意：此处不再重复调用，逻辑已包含在 synthesis 处理流中
          console.log(
            `[useCourseGeneration] 🚀 启动首章节预生成: ${course.id}`,
          );
          aiGatewayAction({
            messages: [
              {
                id: `gen-${Date.now()}`,
                role: "user",
                parts: [
                  {
                    type: "text",
                    text: "请生成第 1 章的内容。",
                    state: "done",
                  },
                ],
              },
            ],
            context: {
              explicitIntent: "COURSE_GENERATION",
              courseGenerationContext: {
                id: course.id,
                userId: session?.user?.id || "",
                goal: state.context.goal || "",
                background: state.context.background || "",
                targetOutcome: state.context.targetOutcome || "",
                cognitiveStyle: state.context.cognitiveStyle || "",
                outlineTitle: data.title,
                outlineData: data,
                moduleCount: data.modules?.length || 0,
                totalChapters: allChapters.length,
                currentModuleIndex: 0,
                currentChapterIndex: 0,
                chaptersGenerated: 0,
              },
            },
          }).catch((err) =>
            console.error("[useCourseGeneration] 后台预生成启动失败:", err),
          );

          // 4. 更新节点状态并进入视觉动画阶段
          const newNodes: CourseNode[] = allChapters.map(
            (ch: Chapter, i: number): CourseNode => ({
              id: `node-${i}`,
              title: ch.title,
              type: "chapter",
              x: Math.cos((i / allChapters.length) * Math.PI * 2) * 280,
              y: Math.sin((i / allChapters.length) * Math.PI * 2) * 280,
              status: "ready",
              depth: 1,
            }),
          );
          dispatch({ type: "SET_NODES", payload: newNodes });

          // 视觉过渡阶段链式推进
          await new Promise((r) =>
            setTimeout(r, PHASE_TRANSITION_DELAYS.synthesis),
          );
          dispatch({ type: "TRANSITION", payload: "seeding" });
        } catch (error) {
          console.error("[useCourseGeneration] 流程中断:", error);
          // 容错处理：即使出错也尝试进入 seeding 阶段，让视觉流程不卡死
          setTimeout(
            () => dispatch({ type: "TRANSITION", payload: "seeding" }),
            1000,
          );
        }
      };

      runGenerationFlow();
    }
  }, [state.phase, state.outline, state.id]);

  // Phase transition chain - 视觉层流转
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;

    // 避免重复处理同一阶段的流转
    if (transitionProcessedRef.current[state.phase]) return;

    switch (state.phase) {
      case "seeding":
        transitionProcessedRef.current["seeding"] = true;
        timer = setTimeout(() => {
          dispatch({ type: "TRANSITION", payload: "growing" });
        }, PHASE_TRANSITION_DELAYS.seeding);
        break;
      case "growing":
        transitionProcessedRef.current["growing"] = true;
        timer = setTimeout(() => {
          dispatch({ type: "TRANSITION", payload: "ready" });
        }, PHASE_TRANSITION_DELAYS.growing);
        break;
      case "ready":
        transitionProcessedRef.current["ready"] = true;
        timer = setTimeout(() => {
          dispatch({ type: "TRANSITION", payload: "manifesting" });
        }, PHASE_TRANSITION_DELAYS.ready);
        break;
      case "manifesting":
        transitionProcessedRef.current["manifesting"] = true;
        timer = setTimeout(() => {
          if (createdCourseId) {
            router.push(`/learn/${createdCourseId}`);
          } else {
            console.error("[useCourseGeneration] Redirect blocked: No ID");
          }
        }, PHASE_TRANSITION_DELAYS.manifesting);
        break;
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [state.phase, createdCourseId, router]);

  const confirmOutline = async (finalOutline: CourseOutline, id?: string) => {
    const unifiedId = id || state.id || crypto.randomUUID();
    if (unifiedId !== state.id) {
      dispatch({ type: "SET_ID", payload: unifiedId });
    }
    dispatch({ type: "SET_OUTLINE", payload: finalOutline });
    dispatch({ type: "TRANSITION", payload: "synthesis" });
  };

  return {
    state,
    ui: {
      userInput: input || "",
      setUserInput: setInput,
      isAiThinking: isLoading || isStarting,
      selectedNode,
      setSelectedNode,
      createdCourseId,
      messages: messages, // Native useChat messages!
      error: error ? error.message : null,
    },
    actions: {
      handleSendMessage,
      selectNode: setSelectedNode,
      confirmOutline,
      retry: () => (error ? regenerate() : sendMessage({ text: "继续" })), // 架构师优化：错误时自动重试，正常时手动推进
      sendMessage,
      stop,
    },
  };
}
