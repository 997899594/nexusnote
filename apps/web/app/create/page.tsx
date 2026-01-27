"use client";

import { useCourseGeneration } from "@/hooks/useCourseGeneration";
import { AmbientBackground } from "@/components/create/AmbientBackground";
import { NexusGraph } from "@/components/create/NexusGraph";
import { ChatInterface } from "@/components/create/ChatInterface";
import { ManifestingOverlay } from "@/components/create/ManifestingOverlay";
import { OrganicHeader } from "@/components/create/OrganicHeader";
import { OutlineReview } from "@/components/create/OutlineReview";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function CreatePageContent() {
  const searchParams = useSearchParams();
  const initialGoal = searchParams.get("goal") || "";
  const { state, ui, actions } = useCourseGeneration(initialGoal);
  const { phase, goal, config, history, nodes, outline } = state;
  const {
    userInput,
    setUserInput,
    isAiThinking,
    aiResponse,
    currentQuestion,
    suggestedUI,
    selectedNode,
    setSelectedNode,
  } = ui;
  const { handleSendMessage, confirmOutline } = actions;

  return (
    <div className="min-h-screen bg-[#FDFDFD] relative overflow-hidden font-sans selection:bg-black/10 selection:text-black">
      {/* Background */}
      <AmbientBackground
        nodes={nodes}
        isThinking={isAiThinking}
        phase={phase}
        progress={Math.min(history.length / 4, 1)}
      />

      {/* Header */}
      <OrganicHeader />

      <main className="relative z-10 w-full h-screen flex items-center justify-center">
        {/* Chat Interface (Interview & Synthesis Phase) */}
        {(phase === "interview" || phase === "synthesis") && (
          <ChatInterface
            phase={phase}
            history={history}
            aiResponse={aiResponse}
            currentQuestion={currentQuestion}
            suggestedUI={suggestedUI}
            isAiThinking={isAiThinking}
            userInput={userInput}
            setUserInput={setUserInput}
            onSendMessage={handleSendMessage}
            goal={goal}
            config={config}
          />
        )}

        {/* Outline Review Phase */}
        {phase === "outline_review" && outline && (
          <OutlineReview
            outline={outline}
            onConfirm={confirmOutline}
            onRefine={(feedback) => handleSendMessage(undefined, feedback)}
            isThinking={isAiThinking}
            aiResponse={aiResponse}
          />
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

export default function CreatePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CreatePageContent />
    </Suspense>
  );
}
