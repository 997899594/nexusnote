"use client";

import { useCourseGeneration } from "@/hooks/useCourseGeneration";
import { AmbientBackground } from "@/components/create/AmbientBackground";
import { NexusGraph } from "@/components/create/NexusGraph";
import { ChatInterface } from "@/components/create/ChatInterface";
import { ManifestingOverlay } from "@/components/create/ManifestingOverlay";
import { OrganicHeader } from "@/components/create/OrganicHeader";
import { OutlineReview } from "@/components/create/OutlineReview";

import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

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
  const { phase, goal, config, nodes, outline } = state;
  const {
    userInput,
    setUserInput,
    isAiThinking,
    selectedNode,
    setSelectedNode,
    messages,
    error,
  } = ui;
  const { handleSendMessage, confirmOutline, retry } = actions;

  return (
    <div className="min-h-screen bg-[#FDFDFD] relative overflow-hidden font-sans selection:bg-black/10 selection:text-black">
      {/* Background */}
      <AmbientBackground
        nodes={nodes}
        isThinking={isAiThinking}
        phase={phase}
        progress={Math.min(messages.length / 8, 1)}
      />

      {/* Header */}
      <OrganicHeader />

      <main className="relative z-10 w-full h-screen flex items-center justify-center">
        {/* Chat Interface (Interview & Synthesis Phase) */}
        {(phase === "interview" || phase === "synthesis") && (
          <ChatInterface
            phase={phase}
            messages={messages}
            isAiThinking={isAiThinking}
            userInput={userInput}
            setUserInput={setUserInput}
            onSendMessage={handleSendMessage}
            goal={goal}
            config={config}
            error={error}
            onRetry={retry}
          />
        )}

        {/* Outline Review Phase */}
        {phase === "outline_review" && outline && (
          <div className="absolute inset-0 z-[150] flex items-center justify-center p-6 bg-white/50 backdrop-blur-sm">
            <OutlineReview
              outline={outline}
              onConfirm={confirmOutline}
              onRefine={(feedback) => handleSendMessage(undefined, feedback)}
              isThinking={isAiThinking}
              messages={messages}
            />
          </div>
        )}

        {/* Graph Visualization (Seeding, Growing, Ready Phases) */}
        <NexusGraph
          nodes={nodes}
          selectedNode={selectedNode}
          onNodeClick={setSelectedNode}
          phase={phase}
          goal={goal}
        />
      </main>

      {/* Final Overlay */}
      <ManifestingOverlay show={phase === "manifesting"} />
    </div>
  );
}
