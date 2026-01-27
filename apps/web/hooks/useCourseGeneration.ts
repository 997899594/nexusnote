"use client";

import { useReducer, useState, useCallback, useEffect, useRef } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { interviewSchema } from "@/lib/schemas/interview";
import { Node } from "@/components/create/types";
import { useRouter } from "next/navigation";
import { learningStore } from "@/lib/storage";

// --- Types ---

export type Phase =
  | "interview"
  | "synthesis"
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

interface State {
  phase: Phase;
  goal: string;
  config: Config;
  history: { q: string; a: string }[];
  nodes: Node[];
}

type Action =
  | { type: "SET_GOAL"; payload: string }
  | { type: "UPDATE_CONFIG"; payload: Partial<Config> }
  | { type: "ADD_HISTORY"; payload: { q: string; a: string } }
  | { type: "SET_NODES"; payload: Node[] }
  | { type: "TRANSITION"; payload: Phase }
  | {
      type: "UPDATE_NODE_STATUS";
      payload: { id: string; status: Node["status"] };
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
  history: [],
  nodes: [],
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_GOAL":
      return { ...state, goal: action.payload };
    case "UPDATE_CONFIG":
      return { ...state, config: { ...state.config, ...action.payload } };
    case "ADD_HISTORY":
      return { ...state, history: [...state.history, action.payload] };
    case "SET_NODES":
      return { ...state, nodes: action.payload };
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

  // Local UI state (not persisted/core logic)
  const [userInput, setUserInput] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [suggestedUI, setSuggestedUI] = useState<{
    type: "options" | "slider" | "confirmation";
    title?: string;
    options?: string[];
    sliderConfig?: any;
  } | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [createdCourseId, setCreatedCourseId] = useState<string | null>(null);
  const router = useRouter();

  // Prevent double-firing in Strict Mode
  const hasStartedRef = useRef(false);

  // Auto-start interview on mount
  useEffect(() => {
    // Only trigger if history is empty and we haven't started (currentQuestion is empty)
    if (
      !hasStartedRef.current &&
      state.history.length === 0 &&
      !currentQuestion &&
      !isAiThinking
    ) {
      hasStartedRef.current = true;
      setIsAiThinking(true);
      submit({
        goal: state.goal,
        history: [],
        currentProfile: state.config,
      });
    }
  }, []); // Run once on mount

  // AI Interview Logic
  const {
    object: aiObject,
    submit,
    isLoading: isAiStreaming,
  } = useObject({
    api: "/api/learn/interview",
    schema: interviewSchema,
    onFinish: ({ object }) => {
      if (!object) return;

      // 1. Update Config
      if (object.configUpdate) {
        dispatch({ type: "UPDATE_CONFIG", payload: object.configUpdate });
      }

      // 2. Suggestions
      if (object.suggestedUI) {
        setSuggestedUI(object.suggestedUI as any);
      }

      // 3. Transition Logic
      // Removing the 4s delay trap, making it more responsive
      // But keeping a small delay for reading if needed, or relying on user interaction

      setAiResponse("");
      setIsAiThinking(false);

      if (object.metaAction === "finish" || object.isComplete) {
        dispatch({ type: "TRANSITION", payload: "synthesis" });
      } else if (object.metaAction === "correction") {
        setCurrentQuestion(object.nextQuestion || "好的，那我们继续。");
      } else {
        setCurrentQuestion(object.nextQuestion || "");
      }
    },
    onError: (error) => {
      console.error("Interview error:", error);
      setAiResponse("我明白了。让我们继续深入探讨...");
      setTimeout(() => {
        setAiResponse("");
        setIsAiThinking(false);
        // Fallback to synthesis on error for demo purposes
        dispatch({ type: "TRANSITION", payload: "synthesis" });
      }, 2000);
    },
  });

  // Sync streaming feedback
  useEffect(() => {
    if (isAiStreaming && aiObject?.feedback) {
      setAiResponse(aiObject.feedback);
    }
  }, [isAiStreaming, aiObject]);

  // Handle Send Message
  const handleSendMessage = useCallback(
    async (e?: React.FormEvent, overrideInput?: string) => {
      if (e) e.preventDefault();
      const answer = overrideInput || userInput;

      if (!answer.trim() || isAiThinking) return;

      const currentQ = currentQuestion;

      dispatch({ type: "ADD_HISTORY", payload: { q: currentQ, a: answer } });
      setUserInput("");
      setSuggestedUI(null);
      setIsAiThinking(true);
      setAiResponse("");

      submit({
        goal: state.goal,
        history: [...state.history, { q: currentQ, a: answer }],
        currentProfile: state.config,
      });
    },
    [
      userInput,
      isAiThinking,
      currentQuestion,
      state.goal,
      state.history,
      state.config,
      submit,
    ],
  );

  // Course Generation Logic (The "Backend" Simulation)
  useEffect(() => {
    if (state.phase === "synthesis") {
      const generateRealCourse = async () => {
        try {
          const response = await fetch("/api/learn/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              goal: state.goal,
              ...state.config,
            }),
          });
          const data = await response.json();

          // Persist course
          try {
            const course = await learningStore.createFromOutline(data);
            setCreatedCourseId(course.id);
          } catch (e) {
            console.error("Failed to persist course:", e);
          }

          // Transform to Nodes
          const newNodes: Node[] = data.chapters.map(
            (ch: any, i: number): Node => ({
              id: `node-${i}`,
              title: ch.title,
              type: "chapter",
              x: Math.cos((i / data.chapters.length) * Math.PI * 2) * 280,
              y: Math.sin((i / data.chapters.length) * Math.PI * 2) * 280,
              status: "ready", // Start ready for now, or animate
              depth: 1,
            }),
          );

          dispatch({ type: "SET_NODES", payload: newNodes });

          // Artificial delay for "Synthesis" effect
          setTimeout(() => {
            dispatch({ type: "TRANSITION", payload: "seeding" });
          }, 2000);
        } catch (error) {
          console.error("Failed to generate course:", error);
          // Fallback simulation
          setTimeout(
            () => dispatch({ type: "TRANSITION", payload: "seeding" }),
            2000,
          );
        }
      };

      generateRealCourse();
    }
  }, [state.phase, state.goal, state.config]);

  // Seeding -> Growing -> Ready -> Manifesting Chain
  useEffect(() => {
    if (state.phase === "seeding") {
      const timer = setTimeout(() => {
        dispatch({ type: "TRANSITION", payload: "growing" });
      }, 2000);
      return () => clearTimeout(timer);
    }
    if (state.phase === "growing") {
      // Simulate nodes popping in (could be handled by internal node state)
      // For now, just quick transition to ready
      const timer = setTimeout(() => {
        dispatch({ type: "TRANSITION", payload: "ready" });
      }, 1500);
      return () => clearTimeout(timer);
    }
    if (state.phase === "ready") {
      const timer = setTimeout(() => {
        dispatch({ type: "TRANSITION", payload: "manifesting" });
      }, 3000);
      return () => clearTimeout(timer);
    }
    if (state.phase === "manifesting") {
      const timer = setTimeout(() => {
        if (createdCourseId) {
          router.push(`/editor/${createdCourseId}`);
        } else {
          // Fallback or error handling
          console.error("No course ID found, cannot redirect");
        }
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [state.phase, createdCourseId, router]);

  return {
    state,
    ui: {
      userInput,
      setUserInput,
      isAiThinking,
      aiResponse,
      currentQuestion,
      suggestedUI,
      selectedNode,
      setSelectedNode,
    },
    actions: {
      handleSendMessage,
    },
  };
}
