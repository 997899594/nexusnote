"use client";

import { useCourseGeneration } from "@/hooks/useCourseGeneration";
import { AmbientBackground } from "@/components/create/AmbientBackground";
import { NexusGraph } from "@/components/create/NexusGraph";
import { ChatInterface } from "@/components/demo/ChatInterface.design";
import { ManifestingOverlay } from "@/components/create/ManifestingOverlay";
import { OrganicHeader } from "@/components/create/OrganicHeader";

export default function DesignCreatePage() {
  const { state, ui, actions } = useCourseGeneration();
  const { phase, goal, config, nodes } = state;
  const {
    userInput,
    setUserInput,
    isAiThinking,
    selectedNode,
    setSelectedNode,
    messages,
  } = ui;
  const { handleSendMessage } = actions;

  return (
    <div className="min-h-screen bg-[#FDFDFD] relative overflow-hidden font-sans selection:bg-black/10 selection:text-black">
      {/* Background */}
      <AmbientBackground
        nodes={nodes}
        isThinking={isAiThinking}
        phase={phase}
        progress={Math.min(messages.length / 4, 1)}
      />

      {/* Header */}
      <OrganicHeader />

      <main className="relative z-10 w-full h-screen flex items-center justify-center">
        {/* Chat Interface (Interview & Synthesis Phase) */}
        {/* Note: demo/ChatInterface uses legacy API, providing compatibility values */}
        <ChatInterface
          phase={phase}
          history={[]}
          aiResponse=""
          currentQuestion=""
          suggestedUI={null}
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
