"use client";

import { useCourseGeneration } from "@/hooks/useCourseGeneration";
import { AmbientBackground } from "@/components/create/AmbientBackground";
import { NexusGraph } from "@/components/create/NexusGraph";
import { ChatInterface } from "@/components/create/ChatInterface";
import { ManifestingOverlay } from "@/components/create/ManifestingOverlay";
import { OrganicHeader } from "@/components/create/OrganicHeader";
import { OutlineReview } from "@/components/create/OutlineReview";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";

export default function CreatePageClient() {
  const searchParams = useSearchParams();
  const goal = searchParams.get("goal")
    ? decodeURIComponent(searchParams.get("goal")!)
    : "";

  // 使用 goal 作为 key，当 goal 改变时强制整个组件树重新挂载
  // 这样所有 state、ref、useEffect 都会重新初始化，避免状态残留
  return <CreatePageContent key={goal} initialGoal={goal} />;
}

interface CreatePageContentProps {
  initialGoal: string;
}

function CreatePageContent({ initialGoal }: CreatePageContentProps) {
  const { state, ui, actions } = useCourseGeneration(initialGoal);
  const { phase, goal, context, nodes, outline } = state;
  const {
    userInput,
    setUserInput,
    isAiThinking,
    selectedNode,
    setSelectedNode,
    createdCourseId,
    messages,
    error,
  } = ui;
  const { handleSendMessage, confirmOutline, retry } = actions;
  const { data: session } = useSession();

  // Track course profile save
  const [courseId, setCourseId] = useState<string | null>(null);

  // Note: 2026 架构师提示：
  // 课程保存逻辑已迁移至 useCourseGeneration 内部使用 saveCourseProfileAction
  // 此处不再需要手写 fetch /api/courses/profile

  return (
    <div className="min-h-screen bg-[#FDFDFD] relative overflow-hidden font-sans selection:bg-black/10 selection:text-black">
      {/* Background */}
      <AmbientBackground
        nodes={nodes}
        isThinking={isAiThinking}
        phase={phase}
        progress={Math.min(messages.length / 8, 1)}
      />

      {/* Header - Hide or dim when reviewing outline to focus */}
      <div
        className={`transition-opacity duration-500 ${phase === "outline_review" || phase === "manifesting" ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      >
        <OrganicHeader />
      </div>

      <main className="relative z-10 w-full h-screen flex items-center justify-center overflow-hidden">
        {/* Phase 1: Interview - Full screen chat */}
        {(phase === "interview" || phase === "synthesis") && !outline && (
          <ChatInterface
            phase={phase}
            messages={messages}
            isAiThinking={isAiThinking}
            userInput={userInput}
            setUserInput={setUserInput}
            onSendMessage={handleSendMessage}
            goal={goal}
            context={context}
            error={error}
            onRetry={retry}
          />
        )}

        {/* Phase 2: Outline Review - Show after generateOutline */}
        <AnimatePresence>
          {phase === "outline_review" && outline && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
              transition={{ duration: 0.5 }}
              className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8 bg-[#FDFDFD]/80 backdrop-blur-xl"
            >
              <OutlineReview
                outline={outline}
                onConfirm={(finalOutline) =>
                  confirmOutline(finalOutline, courseId || undefined)
                }
                onRefine={(feedback) => handleSendMessage(undefined, feedback)}
                isThinking={isAiThinking}
                messages={messages}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Graph Visualization (Seeding, Growing, Ready Phases) */}
        {(phase === "seeding" || phase === "growing" || phase === "ready") && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: "blur(20px)" }}
            className="w-full h-full"
          >
            <NexusGraph
              nodes={nodes}
              selectedNode={selectedNode}
              onNodeClick={setSelectedNode}
              phase={phase}
              goal={goal}
            />
          </motion.div>
        )}
      </main>

      {/* Final Overlay */}
      <ManifestingOverlay show={phase === "manifesting"} />
    </div>
  );
}
