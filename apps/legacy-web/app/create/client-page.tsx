"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { ChatInterface } from "@/features/learning/components/create/ChatInterface";
import { OrganicHeader } from "@/features/learning/components/create/OrganicHeader";
import { useInterview } from "@/features/learning/hooks/useInterview";

interface CreatePageClientProps {
  userId: string;
}

export default function CreatePageClient({ userId }: CreatePageClientProps) {
  const searchParams = useSearchParams();
  const goal = searchParams.get("goal")
    ? decodeURIComponent(searchParams.get("goal")!)
    : "";

  return <CreatePageContent key={goal} initialGoal={goal} userId={userId} />;
}

interface CreatePageContentProps {
  initialGoal: string;
  userId: string;
}

function CreatePageContent({ initialGoal }: CreatePageContentProps) {
  const {
    phase,
    messages,
    isLoading,
    error,
    input,
    setInput,
    handleSendMessage,
    handleOptionSelect,
    handleConfirmOutline,
    handleAdjustOutline,
    proposedOutline,
  } = useInterview({ initialGoal });

  return (
    <div className="min-h-screen bg-[#FDFDFD] relative overflow-hidden font-sans selection:bg-black/10 selection:text-black">
      {/* Header */}
      <div
        className={`transition-opacity duration-500 ${
          phase === "reviewing" || phase === "generating" || phase === "completed"
            ? "opacity-0 pointer-events-none"
            : "opacity-100"
        }`}
      >
        <OrganicHeader />
      </div>

      <main className="relative z-10 w-full h-screen flex items-center justify-center overflow-hidden">
        {/* Interview Chat */}
        <ChatInterface
          phase={phase}
          messages={messages}
          isAiThinking={isLoading}
          userInput={input}
          setUserInput={setInput}
          onSendMessage={handleSendMessage}
          onOptionSelect={handleOptionSelect}
          goal={initialGoal}
          error={error}
          proposedOutline={proposedOutline}
          onConfirmOutline={handleConfirmOutline}
          onAdjustOutline={handleAdjustOutline}
        />

        {/* TODO: Phase reviewing — outline generation + review UI (Task 10) */}
        {/* TODO: Phase generating — BullMQ progress UI (Task 11) */}
      </main>
    </div>
  );
}
