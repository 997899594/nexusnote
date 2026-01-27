"use client";

import { useCourseGeneration } from "@/hooks/useCourseGeneration";
import { AmbientBackground } from "@/components/demo/AmbientBackground";
import { NexusGraph } from "@/components/demo/NexusGraph";
import { ChatInterface } from "@/components/demo/ChatInterface";
import { ManifestingOverlay } from "@/components/demo/ManifestingOverlay";
import { OrganicHeader } from "@/components/demo/OrganicHeader";

export default function DesignCreatePage() {
  const { state, ui, actions } = useCourseGeneration();
  const { phase, goal, config, history, nodes } = state;
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
  const { handleSendMessage } = actions;

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
