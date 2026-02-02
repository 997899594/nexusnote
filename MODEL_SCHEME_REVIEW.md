# NexusNote 2026 AI Architecture Standard

**Status**: Implemented (Vercel AI SDK v6)  
**Date**: 2026-02-02  
**Version**: 2.0 (Code-Driven FSM + Hybrid Streaming)

---

## 1. Core Philosophy: "Code-Driven, Not Prompt-Driven"

The architecture has shifted from a fragile "Prompt-Driven" (God Mode) approach to a robust **"Code-Driven Agentic Workflow"**. We no longer rely on a single prompt to manage complex logic. Instead, **Code controls the flow, and AI generates the content.**

### Key Architectural Pillars

1.  **Router + FSM Pattern**: Explicit routing and state management prevent hallucinations and "looping" issues.
2.  **Specialist Agents**: Dedicated agents with optimized configurations (Temperature, Model) for specific tasks.
3.  **Hybrid Streaming**: Combining `streamText` for speed with `experimental_output` (JSON) for structure.
4.  **Strict Type Safety**: Full adherence to Vercel AI SDK v6 strict typing (`UIMessage` vs `CoreMessage`).

---

## 2. Temperature Strategy (The "Entropy Control")

Temperature is no longer a global constant. It is a **strategic resource** tuned per-agent and per-step to balance creativity vs. stability.

| Agent          | Temperature   | Role              | Rationale                                                                                                 |
| :------------- | :------------ | :---------------- | :-------------------------------------------------------------------------------------------------------- |
| **Router**     | **0.0**       | **The Brain**     | **Absolute Zero**. Classification must be deterministic. Same input = Same output. No creativity allowed. |
| **Interview**  | **0.2**       | **The Architect** | **Low Entropy**. Structure is priority. Ensures JSON options are valid and logic flow is precise.         |
| **Editor**     | **0.1 - 0.8** | **The Craftsman** | **Dynamic**. 0.1 for precise grammar fixes; 0.8 for "Make it more creative" requests.                     |
| **Chat / RAG** | **0.7**       | **The Companion** | **High Entropy**. Natural, empathetic, and varied responses. Avoids robotic repetition.                   |

**Implementation Reference**:

- `lib/ai/router/route.ts`: Hardcoded `temperature: 0`
- `lib/ai/agents/interview/machine.ts`: `temperature: 0.2` for steps, `0.0` for extraction.
- `app/api/chat/route.ts`: `temperature: 0.7` for general chat.

---

## 3. Component Architecture

### 3.1 The Router (Intent Classification)

- **Model**: `fastModel` (e.g., gpt-4o-mini)
- **Method**: `generateText` + `experimental_output` (Schema-based)
- **Logic**:
  - Intercepts user query.
  - Classifies into: `INTERVIEW` (Structured), `CHAT` (Open), `SEARCH` (Live Info), `EDITOR` (Modification).
  - **Context Aware**: Checks `interviewState` to prevent breaking out of active flows.

### 3.2 The Interview Agent (Finite State Machine)

Replaces "Chat" with a rigid FSM.

- **States**: `IDLE` -> `ASK_GOAL` -> `ASK_BACKGROUND` -> `ASK_TIME` -> `CONFIRM` -> `GENERATING`.
- **Logic**:
  - **IDLE Smart Jump**: If user says "I want to learn Python", FSM auto-extracts goal and **skips** to `ASK_BACKGROUND` immediately.
  - **Output**: Uses `experimental_output` to strictly enforce JSON schema for UI cards (Options, Confirmation).
  - **Fallback**: `streamText` ensures user sees text immediately even if JSON is complex.

### 3.3 The Chat Agent (Hybrid Streamer)

- **Model**: `chatModel` (e.g., gpt-4o)
- **Method**: `streamText`
- **Features**:
  - **RAG Integration**: Injects retrieved context from `ragService`.
  - **Tool Calling**: Native Vercel AI SDK tool definitions.
  - **Web Search**: Dynamic toggle based on Router decision.

---

## 4. Technical Implementation Details (SDK v6)

### 4.1 Message Handling (`UIMessage` vs `CoreMessage`)

Vercel AI SDK v6 enforces a strict separation of concerns. We adhere to this pattern to prevent type errors.

- **Frontend (`UIMessage`)**: Contains `parts` (Text, ToolInvocation, Reason). **No `content` property.**
- **Backend (`CoreMessage`)**: Pure model input.
- **Bridge**:
  ```typescript
  // app/api/chat/route.ts
  import { convertToCoreMessages } from "ai";
  // ✅ Correct: Synchronous conversion of UI parts to Model text
  const coreMessages = convertToCoreMessages(messages);
  ```

### 4.2 Frontend Parsing (Hybrid UI)

The `ChatInterface` handles the "Hybrid Stream":

1.  **Text Stream**: Rendered as markdown.
2.  **Partial JSON**:
    - The FSM outputs structured JSON (e.g., `{ type: "options", options: [...] }`).
    - **Robust Parsing**: We use a `try-parse` + `regex-fallback` strategy to extract valid JSON even during streaming (Partial JSON).
    - This allows UI cards to appear _while_ the AI is still typing.

### 4.3 Directory Structure

```
apps/web/lib/ai/
├── router/             # Intent Router (Temp 0.0)
│   └── route.ts
├── agents/
│   ├── interview/      # FSM Logic (Temp 0.2)
│   │   ├── machine.ts  # State Machine & Extraction
│   │   └── schema.ts   # Zod Schemas
│   └── chat-agent.ts   # General Chat Tools
├── skills/             # Reusable Tools (Quiz, MindMap)
│   ├── learning.ts
│   └── web.ts
└── registry.ts         # Model Provider Config
```

---

## 5. Verification & Quality Assurance

### 5.1 "No Hallucination" Guarantee

- **Mechanism**: The FSM _cannot_ transition to an invalid state. It _cannot_ ask "What is your goal?" if the goal is already set in the context.
- **Verification**: User input "My goal is AI" -> System responds "Great, what is your background?" (Skipped redundant question).

### 5.2 "No Waiting" Guarantee

- **Mechanism**: Hybrid Streaming.
- **Experience**: The user sees the text "I can help with that..." immediately, while the complex JSON options are being generated in the background.

---

**Prepared for**: Architecture Review Board  
**Maintainer**: NexusNote AI Team
