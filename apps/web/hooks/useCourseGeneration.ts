import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  useState,
  useReducer,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { CourseNode } from "@/lib/types/course";
import { useRouter } from "next/navigation";
import { learningStore } from "@/lib/storage";

// ============================================
// Constants
// ============================================

const PHASE_TRANSITION_DELAYS = {
  synthesis: 2000,
  seeding: 2000,
  growing: 1500,
  ready: 3000,
  manifesting: 4000,
} as const;

// --- Types ---

export type Phase =
  | "interview"
  | "synthesis"
  | "outline_review"
  | "seeding"
  | "growing"
  | "ready"
  | "manifesting";

interface Config {
  level: string;
  levelDescription?: string;
  time: string;
  priorKnowledge?: string[];
  targetOutcome?: string;
  cognitiveStyle?: string;
}

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
  config: Config;
  // history removed in favor of useChat messages
  nodes: CourseNode[];
  outline: CourseOutline | null;
}

type Action =
  | { type: "SET_GOAL"; payload: string }
  | { type: "UPDATE_CONFIG"; payload: Partial<Config> }
  | { type: "SET_NODES"; payload: CourseNode[] }
  | { type: "SET_OUTLINE"; payload: CourseOutline }
  | { type: "TRANSITION"; payload: Phase }
  | {
      type: "UPDATE_NODE_STATUS";
      payload: { id: string; status: CourseNode["status"] };
    };

// --- Reducer ---

const initialState: State = {
  phase: "interview",
  goal: "",
  config: {
    level: "",
    levelDescription: "",
    time: "",
    priorKnowledge: [],
    targetOutcome: "",
    cognitiveStyle: "action_oriented",
  },
  nodes: [],
  outline: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_GOAL":
      return { ...state, goal: action.payload };
    case "UPDATE_CONFIG":
      return { ...state, config: { ...state.config, ...action.payload } };
    case "SET_NODES":
      return { ...state, nodes: action.payload };
    case "SET_OUTLINE":
      return { ...state, outline: action.payload };
    case "TRANSITION":
      return { ...state, phase: action.payload };
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

  // Prevent double-firing in Strict Mode
  const hasStartedRef = useRef(false);

  // 当 initialGoal 改变时，同步到 state 并重置 autostart
  useEffect(() => {
    if (initialGoal && initialGoal !== state.goal) {
      console.log(
        "[useCourseGeneration] Initial goal changed:",
        initialGoal,
        "resetting autostart",
      );
      dispatch({ type: "SET_GOAL", payload: initialGoal });
      hasStartedRef.current = false;
    }
  }, [initialGoal]);

  // Manual Input State
  const [input, setInput] = useState("");

  // Phase ref for onToolCall (避免闭包陷阱)
  const phaseRef = useRef(state.phase);
  useEffect(() => {
    phaseRef.current = state.phase;
  }, [state.phase]);

  // Transport for interview API
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/learn/interview" }),
    [],
  );

  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // useChat Integration - SDK v6 使用 transport 配置
  const { messages, sendMessage, status, regenerate } = useChat({
    transport,
    onToolCall: async ({ toolCall }) => {
      // SDK v6: toolCall 有 type 属性如 'tool-updateProfile'
      // 提取工具名称
      const toolType = (toolCall as unknown as { type: string }).type;
      const toolName = toolType.startsWith("tool-")
        ? toolType.slice(5)
        : toolType;

      // SDK v6: 使用 input 而不是 args
      const input = (toolCall as unknown as { input?: unknown }).input;

      switch (toolName) {
        case "updateProfile": {
          if (input) {
            dispatch({
              type: "UPDATE_CONFIG",
              payload: input as Partial<Config>,
            });
          }
          break;
        }

        case "updateOutline": {
          const outlineInput = input as
            | {
                title: string;
                description: string;
                difficulty: "beginner" | "intermediate" | "advanced";
                estimatedMinutes: number;
                modules: Module[];
                reason: string;
              }
            | undefined;

          if (outlineInput) {
            const allChapters = outlineInput.modules.flatMap((m) => m.chapters);

            const outlinePayload: CourseOutline = {
              title: outlineInput.title,
              description: outlineInput.description,
              difficulty: outlineInput.difficulty,
              estimatedMinutes: outlineInput.estimatedMinutes,
              modules: outlineInput.modules,
              chapters: allChapters.map((ch) => ({
                title: ch.title,
                summary: ch.contentSnippet || "",
                keyPoints: [],
                contentSnippet: ch.contentSnippet,
              })),
            };
            dispatch({ type: "SET_OUTLINE", payload: outlinePayload });

            // 生成可视化节点
            const newNodes: CourseNode[] = allChapters.map(
              (ch, i): CourseNode => ({
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

            // 转换到大纲审核阶段
            if (phaseRef.current !== "outline_review") {
              dispatch({ type: "TRANSITION", payload: "outline_review" });
            }
          }
          break;
        }

        case "confirmCourse": {
          dispatch({ type: "TRANSITION", payload: "synthesis" });
          break;
        }
      }
    },
    onError: (err: Error) => {
      console.error("[useCourseGeneration] Chat error:", err);
      setError(err.message);
    },
  });

  const isAiThinking = status === "submitted" || status === "streaming" || isStarting;

  // Auto-start interview on mount
  // 只在 goal 存在且消息为空时触发一次
  useEffect(() => {
    // 如果已经有消息、或者没有目标，则跳过
    if (messages.length > 0 || !state.goal) {
      return;
    }

    // 防止 Strict Mode 下的重复执行
    if (hasStartedRef.current) {
      return;
    }

    console.log("[useCourseGeneration] Starting autostart...");
    hasStartedRef.current = true;
    setIsStarting(true);

    // 直接调用，不使用 setTimeout
    sendMessage(
      { text: `我的目标是：${state.goal}。请开始访谈。` },
      {
        body: {
          goal: state.goal,
          phase: state.phase,
          currentProfile: state.config,
          currentOutline: state.outline,
        },
      },
    )
      .catch((err) => {
        console.error("Autostart failed:", err);
        setError(err.message);
      })
      .finally(() => {
        // 无论成功失败，都结束启动状态
        // 如果成功，messages.length > 0，Effect 不会再次触发
        // 如果失败，error 会显示，或者允许重试
        setIsStarting(false);
      });
  }, [state.goal, messages.length, sendMessage, state.phase, state.config, state.outline]);

  // Handle Send Message - 直接使用 state，无需 ref
  const handleSendMessage = useCallback(
    async (e?: React.FormEvent, overrideInput?: string) => {
      if (e) e.preventDefault();

      const text = overrideInput ?? input;
      if (!text.trim()) return;

      // 清空输入框（仅当使用 input 时）
      if (!overrideInput) {
        setInput("");
      }

      // SDK v6: 使用 { text: string } 格式
      await sendMessage(
        { text },
        {
          body: {
            goal: state.goal,
            phase: state.phase,
            currentProfile: state.config,
            currentOutline: state.outline,
          },
        },
      );
    },
    [input, sendMessage, state.goal, state.phase, state.config, state.outline],
  );

  // Course Generation Logic (The "Backend" Simulation)
  useEffect(() => {
    if (state.phase === "synthesis") {
      const generateRealCourse = async () => {
        try {
          let data;

          // If we already have a refined outline, use it!
          if (state.outline) {
            data = state.outline;
          } else {
            // Fallback: Generate from scratch (should rarely happen if flow is correct)
            const response = await fetch("/api/learn/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                goal: state.goal,
                ...state.config,
              }),
            });
            data = await response.json();
          }

          // Persist course
          try {
            const course = await learningStore.createFromOutline(data);
            setCreatedCourseId(course.id);
          } catch (e) {
            console.error("Failed to persist course:", e);
          }

          // Transform to Nodes (for visualization)
          // Ensure chapters exist
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
              status: "ready", // Start ready for now, or animate
              depth: 1,
            }),
          );

          dispatch({ type: "SET_NODES", payload: newNodes });

          // Transition delay for "Synthesis" effect
          setTimeout(() => {
            dispatch({ type: "TRANSITION", payload: "seeding" });
          }, PHASE_TRANSITION_DELAYS.synthesis);
        } catch (error) {
          console.error(
            "[useCourseGeneration] Failed to generate course:",
            error,
          );
          // Fallback: still transition to seeding
          setTimeout(
            () => dispatch({ type: "TRANSITION", payload: "seeding" }),
            PHASE_TRANSITION_DELAYS.synthesis,
          );
        }
      };

      generateRealCourse();
    }
  }, [state.phase, state.goal, state.config]);

  // Phase transition chain: Seeding -> Growing -> Ready -> Manifesting
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
            router.push(`/editor/${createdCourseId}`);
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

  // Actions for Outline Review
  const confirmOutline = async (finalOutline: CourseOutline) => {
    // We update the state with the final outline, then transition to synthesis.
    // The actual persistence happens in the synthesis phase (generateRealCourse).
    dispatch({ type: "SET_OUTLINE", payload: finalOutline });
    dispatch({ type: "TRANSITION", payload: "synthesis" });
  };

  return {
    state,
    ui: {
      userInput: input || "",
      setUserInput: setInput,
      isAiThinking,
      selectedNode,
      setSelectedNode,
      messages,
      error,
    },
    actions: {
      handleSendMessage,
      selectNode: setSelectedNode,
      confirmOutline,
      retry: () => regenerate(),
    },
  };
}
