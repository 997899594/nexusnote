# NexusNote 2026 AI Architecture Review

## 1. Executive Summary: The "Agentic Workflow" Shift

This document outlines the architectural transformation of NexusNote from a **Prompt-Driven (God-Mode)** system to a **Code-Driven (Agentic Workflow)** system.

### The Problem (Current State)

- **God-Mode Delusion**: Single "Interview Agent" trying to handle conversation, logic, and tool selection simultaneously.
- **Black Box Tooling**: Relying on LLM probability to call tools correctly.
- **Unstable UX**: Hallucinations (e.g., replying with single words like "运动"), self-answering, and inconsistent UI rhythm.

### The Solution (2026 Architecture)

- **Architecture**: **Router + FSM (Finite State Machine) + Specialist Agents**.
- **Philosophy**: **Code controls the flow; AI generates the content.**
- **Tech Stack**: Next.js 15, Vercel AI SDK v6 (Core/UI), Zod (Schema).

---

## 2. Core Architecture Design

### 2.1 The Router (The Brain)

A lightweight classifier that directs user intent to the correct specialist.

- **Model**: `gpt-4o-mini` (Fast, Cheap)
- **Mechanism**: `generateObject` (Strict JSON)
- **Output Schema**:
  ```typescript
  type RouterOutput = {
    target: "INTERVIEW" | "CHAT" | "SEARCH" | "EDITOR";
    parameters?: Record<string, any>;
  };
  ```

### 2.2 Interview Agent (The FSM)

Replaces the "free-form chat" with a strict State Machine.

**States:**

1.  **`IDLE`**: Initial state.
2.  **`ASK_GOAL`**: Extract user goal -> Transition to `ASK_BACKGROUND`.
3.  **`ASK_BACKGROUND`**: Generate options based on goal -> Transition to `ASK_TIME`.
4.  **`ASK_TIME`**: Confirm commitment -> Transition to `GENERATING`.
5.  **`GENERATING`**: Execute `generateOutline` -> Transition to `review`.

**Logic:**

- **Code** dictates the current state.
- **AI** is only used to:
  - Extract entities (e.g., "I want to learn React" -> `goal: "React Development"`).
  - Generate context-aware options (e.g., "Beginner", "Intermediate").
  - Polish UI text.

### 2.3 Chat Agent (The Streamer)

Handles open-ended Q&A and RAG.

- **Strategy**: **Stream Text** (Low Latency).
- **Correction**: unlike Interview Agent (JSON-First), Chat Agent **MUST** stream text to avoid "waiting silence" for long responses.
- **Tools**: RAG (Retriever), Web Search (Tavily).

---

## 3. Implementation Guidelines

### 3.1 JSON-First vs. Stream-First Strategy

| Agent Type     | Strategy                | Reason                                                                           |
| :------------- | :---------------------- | :------------------------------------------------------------------------------- |
| **Interview**  | **JSON-First** (Object) | Requires precise UI rendering (Cards, Options). Short text, low latency penalty. |
| **Router**     | **JSON-First** (Object) | Machine-to-machine communication only.                                           |
| **Chat / RAG** | **Stream-First** (Text) | Long-form answers. Users need immediate feedback (TTFB).                         |

### 3.2 Code Structure

```
apps/web/lib/ai/
├── router/             # Intent Classification
│   └── route.ts
├── agents/
│   ├── interview/      # FSM Implementation
│   │   ├── machine.ts  # State Logic
│   │   └── prompt.ts   # Targeted Prompts
│   ├── chat/           # Streaming Chat
│   └── editor/         # Document Editor
└── registry.ts         # Model Configuration
```

---

## 4. Migration Plan

1.  **Phase 1: Router & FSM Setup**
    - Implement `route.ts` classifier.
    - Build `interview-machine.ts`.
2.  **Phase 2: Agent Refactoring**
    - Strip `interview-agent.ts` of complex logic.
    - Implement `generateObject` for interview steps.
3.  **Phase 3: UI Adaptation**
    - Update `ChatInterface` to handle `RouterOutput`.
    - Ensure smooth streaming for Chat Agent.

---

> **Status**: Approved. Proceeding with implementation.
