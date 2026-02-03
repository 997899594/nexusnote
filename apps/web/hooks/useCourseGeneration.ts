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
  nodes: CourseNode[];
  outline: CourseOutline | null;
}

type Action =
  | { type: "SET_GOAL"; payload: string }
  | { type: "UPDATE_CONFIG"; payload: Partial<Config> }
  | { type: "SET_NODES"; payload: CourseNode[] }
  | { type: "SET_OUTLINE"; payload: CourseOutline }
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
    () => new DefaultChatTransport({ api: "/api/learn/interview" }),
    [],
  );

  const { messages, sendMessage, setMessages, status, error, reload } = useChat(
    {
      transport: chatTransport,
    },
  );

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
        console.log("[useCourseGeneration] Resuming chat from history...");
        // Ensure we pass the current interview context when reloading
        reload({
          body: {
            interviewContext: {
              goal: state.goal,
              ...state.config,
            },
          },
        });
      }
    }
  }, [status, messages, reload, state.goal, state.config]);

  useEffect(() => {
    if (!messages || messages.length === 0) return;

    const lastMessage = messages[messages.length - 1] as any;
    if (!lastMessage.toolInvocations) return;

    lastMessage.toolInvocations.forEach((toolInvocation: any) => {
      // Only process if we haven't processed this tool call yet
      if (processedToolCallIds.current.has(toolInvocation.toolCallId)) return;

      // Only process if we have the args (it's a call)
      // Note: In server-side execution, we get the result eventually.
      // But we can update UI optimistically or when args are ready.
      // Since we want to update the form, args are enough.

      if (toolInvocation.toolName === "updateProfile") {
        const args = toolInvocation.args as any;
        const updates: Partial<Config> & { goal?: string } = {};

        if (args.goal) updates.goal = args.goal;
        if (args.background) updates.priorKnowledge = [args.background];
        if (args.time) updates.time = args.time;

        if (Object.keys(updates).length > 0) {
          console.log("[Tool Sync] updateProfile:", updates);
          if (updates.goal)
            dispatch({ type: "SET_GOAL", payload: updates.goal });

          const configUpdates: Partial<Config> = {};
          if (updates.priorKnowledge)
            configUpdates.priorKnowledge = updates.priorKnowledge;
          if (updates.time) configUpdates.time = updates.time;

          if (Object.keys(configUpdates).length > 0) {
            dispatch({ type: "UPDATE_CONFIG", payload: configUpdates });
          }
        }
        processedToolCallIds.current.add(toolInvocation.toolCallId);
      }

      if (toolInvocation.toolName === "generateOutline") {
        // Wait for the full outline to be available?
        // Ideally wait for 'result' state if server executes it, but args should be fine if complete.
        // However, large JSON might stream.
        // Safer to wait until the tool invocation is complete (has result) or check if args are valid.
        // But 'state' property might be specific to client-side tools.
        // Let's assume args are usable when they appear, but for safety we might want to wait for the next message or check 'state'.
        // In AI SDK, toolInvocations are updated as tokens stream.
        // We should probably wait for the tool call to be "done" or parse carefully.
        // But for now, let's trust the args are valid JSON once parsed.

        // Better: Wait for the tool invocation to have a result (server finished execution)
        // OR simply update when we have valid data.

        // Simple check: if we have the fields we need
        const outline = toolInvocation.args as any;
        if (outline && outline.title && outline.modules) {
          console.log("[Tool Sync] generateOutline:", outline);

          const outlinePayload: CourseOutline = {
            title: outline.title,
            description: outline.description,
            difficulty: outline.difficulty,
            estimatedMinutes: outline.estimatedMinutes,
            modules: outline.modules,
            chapters: outline.modules
              .flatMap((m: any) => m.chapters || [])
              .map((ch: any) => ({
                title: ch.title,
                contentSnippet: ch.contentSnippet,
                summary: ch.contentSnippet || "",
              })),
          };

          if (state.phase === "interview") {
            dispatch({ type: "SET_OUTLINE", payload: outlinePayload });

            const allChapters = outlinePayload.chapters || [];
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
          }
          processedToolCallIds.current.add(toolInvocation.toolCallId);
        }
      }
    });
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
    if (messages.length > 0 || !state.goal || hasStartedRef.current) return;

    console.log("[useCourseGeneration] Starting autostart...");
    hasStartedRef.current = true;
    setIsStarting(true);

    // Initial message to kickstart the AI
    sendMessage(
      {
        text: state.goal,
      },
      {
        body: {
          interviewContext: {
            goal: state.goal,
            ...state.config,
          },
        },
      },
    );

    setIsStarting(false);
  }, [state.goal, messages.length, sendMessage, state.config]);

  // Handle Send Message
  const handleSendMessage = useCallback(
    async (e?: React.FormEvent, overrideInput?: string) => {
      if (e) e.preventDefault();
      const text = overrideInput ?? input;
      if (!text.trim()) return;

      if (!overrideInput) setInput("");

      sendMessage(
        {
          text: text,
        },
        {
          body: {
            interviewContext: {
              goal: state.goal,
              ...state.config,
            },
          },
        },
      );
    },
    [input, state.goal, state.config, sendMessage],
  );

  // Course Generation Logic (The "Backend" Simulation) - Unchanged
  useEffect(() => {
    if (state.phase === "synthesis") {
      const generateRealCourse = async () => {
        try {
          let data;
          if (state.outline) {
            data = state.outline;
          } else {
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

          try {
            const course = await learningStore.createFromOutline(data);
            setCreatedCourseId(course.id);
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
  }, [state.phase, state.goal, state.config]);

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

  const confirmOutline = async (finalOutline: CourseOutline) => {
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
