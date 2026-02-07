import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  useState,
  useReducer,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { CourseNode } from "@/lib/types/course";
import { useRouter } from "next/navigation";
import { learningStore } from "@/lib/storage";
import type { CourseOutline as StoreCourseOutline } from "@/lib/storage/learning-store";
import type {
  InterviewAgentMessage,
  InterviewContext,
} from "@/lib/ai/agents/interview/agent";

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

  const chatTransport = useMemo(
    () => new DefaultChatTransport({ api: "/api/ai" }),
    [],
  );

  const { messages, sendMessage, setMessages, status, error, regenerate } =
    useChat<InterviewAgentMessage>({
      transport: chatTransport,
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
            context: {
              explicitIntent: "INTERVIEW",
              interviewContext: state.context,
              isInInterview: true,
            },
          },
        });
      }
    }
  }, [status, messages, regenerate, state.context]);

  useEffect(() => {
    if (!messages || messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "assistant" || !lastMessage.parts) return;

    console.log("[Tool Sync] Checking message parts");

    // AI SDK v6 Agent UI: 工具在 message.parts，格式 {type: 'tool-xxx', input: {...}}
    const generateOutlinePart = lastMessage.parts.find(
      (p) =>
        p.type === "tool-generateOutline" && p.state === "output-available",
    );

    if (
      !generateOutlinePart ||
      generateOutlinePart.type !== "tool-generateOutline"
    )
      return;
    if (processedToolCallIds.current.has(generateOutlinePart.toolCallId))
      return;

    console.log("[Tool Sync] Found generateOutline");

    const outline = generateOutlinePart.input;
    if (!outline.title || !outline.modules) {
      console.log("[Tool Sync] Invalid outline data");
      return;
    }

    console.log("[Tool Sync] Processing outline:", outline.title);

    const outlinePayload: CourseOutline = {
      title: outline.title,
      description: outline.description,
      difficulty: outline.difficulty,
      estimatedMinutes: outline.estimatedMinutes,
      modules: outline.modules,
      chapters: outline.modules
        .flatMap((m: any) => m.chapters)
        .map((ch: any) => ({
          title: ch.title,
          contentSnippet: ch.contentSnippet,
          summary: ch.contentSnippet || "",
        })),
    };

    dispatch({ type: "SET_OUTLINE", payload: outlinePayload });

    const allChapters = outlinePayload.chapters!;
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
    dispatch({ type: "TRANSITION", payload: "outline_review" });

    processedToolCallIds.current.add(generateOutlinePart.toolCallId);

    console.log("[Tool Sync] Transitioned to outline_review");
  }, [messages, state.phase]);

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
          context: {
            explicitIntent: "INTERVIEW",
            interviewContext: state.context,
            isInInterview: true,
          },
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
            context: {
              explicitIntent: "INTERVIEW",
              interviewContext: finalContext, // ← 保证使用计算出的最新值
              isInInterview: true,
            },
          },
        },
      );
    },
    [input, state.context, sendMessage],
  );

  // Course Generation Logic (The "Backend" Simulation) - Unchanged
  useEffect(() => {
    if (state.phase === "synthesis") {
      const generateRealCourse = async () => {
        try {
          if (!state.outline) {
            console.error("No outline available for course generation");
            return;
          }

          const data = state.outline;

          try {
            // 从 modules 或 chapters 中提取章节，转换为 learningStore 要求的格式
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
              state.id,
            );
            setCreatedCourseId(course.id);

            // 架构师优化：大纲确认后立即触发后台并行生成 (Parallel Seeding)
            // 无需等待用户跳转到学习页面，提前预热首章节内容
            // 使用 keepalive: true 确保即使页面跳转，请求也能在后台完成
            console.log(
              `[useCourseGeneration] 🚀 启动首章节后台预生成: ${course.id}`,
            );
            fetch("/api/ai", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              keepalive: true, // 关键：确保跳转后请求不中断
              body: JSON.stringify({
                messages: [{ role: "user", content: "请生成第 1 章的内容。" }],
                context: {
                  explicitIntent: "COURSE_GENERATION",
                  courseGenerationContext: {
                    id: course.id,
                    goal: state.context.goal,
                    background: state.context.background,
                    targetOutcome: state.context.targetOutcome,
                    cognitiveStyle: state.context.cognitiveStyle,
                    outlineTitle: data.title,
                    outlineData: data,
                    moduleCount: data.modules?.length || 0,
                    totalChapters: allChapters.length,
                    currentChapterIndex: 0,
                    chaptersGenerated: 0,
                  },
                },
              }),
            }).catch((err) =>
              console.error("[useCourseGeneration] 后台生成启动失败:", err),
            );
          } catch (e) {
            console.error("Failed to persist course:", e);
          }

          const chapters: Chapter[] =
            data.chapters ||
            (data.modules
              ? data.modules.flatMap((m: Module) => m.chapters)
              : []);

          const newNodes: CourseNode[] = chapters.map(
            (ch: Chapter, i: number): CourseNode => ({
              id: `node-${i}`,
              title: ch.title,
              type: "chapter",
              x: Math.cos((i / chapters.length) * Math.PI * 2) * 280,
              y: Math.sin((i / chapters.length) * Math.PI * 2) * 280,
              status: "ready",
              depth: 1,
            }),
          );

          dispatch({ type: "SET_NODES", payload: newNodes });

          setTimeout(() => {
            dispatch({ type: "TRANSITION", payload: "seeding" });
          }, PHASE_TRANSITION_DELAYS.synthesis);
        } catch (error) {
          console.error(
            "[useCourseGeneration] Failed to generate course:",
            error,
          );
          setTimeout(
            () => dispatch({ type: "TRANSITION", payload: "seeding" }),
            PHASE_TRANSITION_DELAYS.synthesis,
          );
        }
      };
      generateRealCourse();
    }
  }, [state.phase, state.goal, state.context]);

  // Phase transition chain - Unchanged
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    switch (state.phase) {
      case "seeding":
        timer = setTimeout(() => {
          dispatch({ type: "TRANSITION", payload: "growing" });
        }, PHASE_TRANSITION_DELAYS.seeding);
        break;
      case "growing":
        timer = setTimeout(() => {
          dispatch({ type: "TRANSITION", payload: "ready" });
        }, PHASE_TRANSITION_DELAYS.growing);
        break;
      case "ready":
        timer = setTimeout(() => {
          dispatch({ type: "TRANSITION", payload: "manifesting" });
        }, PHASE_TRANSITION_DELAYS.ready);
        break;
      case "manifesting":
        timer = setTimeout(() => {
          if (createdCourseId) {
            router.push(`/learn/${createdCourseId}`);
          } else {
            console.error(
              "[useCourseGeneration] No course ID found, cannot redirect",
            );
          }
        }, PHASE_TRANSITION_DELAYS.manifesting);
        break;
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [state.phase, createdCourseId, router]);

  const confirmOutline = async (finalOutline: CourseOutline, id?: string) => {
    if (id) {
      dispatch({ type: "SET_ID", payload: id });
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
      retry: () => sendMessage({ text: "继续" }), // Simple retry
      sendMessage,
    },
  };
}
