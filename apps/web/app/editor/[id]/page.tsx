"use client";

import { useState, useEffect, use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Book, Edit3, Split, Sparkles, X, Layout } from "lucide-react";
import { Editor } from "@/components/editor/Editor";
import { MaterialViewer } from "@/components/workpanel/MaterialViewer";
import { ChatSidebar } from "@/components/ai/ChatSidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { EditorProvider } from "@/contexts/EditorContext";
import {
  NoteExtractionProvider,
  useNoteExtraction,
} from "@/contexts/NoteExtractionContext";
import { useSession } from "next-auth/react";
import { getDocumentAction } from "@/app/actions/document";

type ViewMode = "read" | "dual" | "notes";

export default function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("notes");
  const [title, setTitle] = useState("开始内化...");
  const [materialTitle, setMaterialTitle] = useState("正在加载笔记...");
  const [docInfo, setDocInfo] = useState<{
    id: string;
    title: string;
    isVault: boolean;
    type?: string;
  } | null>(null);

  const { data: session } = useSession();

  // Fetch document info
  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const result = await getDocumentAction(id);
        if (result.success && result.data) {
          const doc = result.data;
          setDocInfo({
            id: doc.id,
            title: doc.title,
            isVault: doc.isVault,
          });
          setMaterialTitle(doc.title || "无标题笔记");
          setTitle(doc.title || "无标题笔记");
        }
      } catch (err) {
        console.error("Failed to fetch doc title:", err);
      }
    };
    fetchDoc();
  }, [id]);

  return (
    <EditorProvider>
      <NoteExtractionProviderWithUser documentId={id}>
        <div className="h-screen bg-[#FDFDFD] overflow-hidden selection:bg-black/5 flex font-sans">
          {/* Organic Background Texture */}
          <div
            className="absolute inset-0 z-0 opacity-[0.02] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Left Sidebar: Minimal App Navigation */}
          <div className="w-20 border-r border-black/[0.04] bg-white/30 backdrop-blur-xl flex flex-col items-center py-8 gap-8 z-50">
            <button
              onClick={() => (window.location.href = "/")}
              className="w-12 h-12 rounded-[20px] bg-black flex items-center justify-center text-white shadow-xl shadow-black/10 hover:scale-105 active:scale-95 transition-all group"
            >
              <Layout className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
            </button>

            <div className="w-8 h-px bg-black/[0.06]" />

            <div className="flex flex-col gap-5">
              {[
                { id: "notes", icon: Edit3, label: "编辑笔记" },
                { id: "dual", icon: Split, label: "对照模式" },
                { id: "read", icon: Book, label: "沉浸阅读" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setViewMode(m.id as ViewMode)}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all group relative ${
                    viewMode === m.id
                      ? "bg-black text-white shadow-lg shadow-black/10 scale-110"
                      : "text-black/20 hover:text-black/60 hover:bg-black/5"
                  }`}
                >
                  <m.icon className="w-5 h-5" />
                  <span className="absolute left-full ml-4 px-3 py-1.5 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 translate-x-[-10px] group-hover:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-[100] shadow-xl">
                    {m.label}
                  </span>
                  {viewMode === m.id && (
                    <motion.div
                      layoutId="active-view-indicator"
                      className="absolute -right-1 w-1 h-5 bg-black rounded-full"
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="flex-1" />

            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500/10 to-emerald-500/10 border border-black/5 flex items-center justify-center overflow-hidden">
              <div className="w-full h-full bg-black/[0.02] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-black/20" />
              </div>
            </div>
          </div>

          {/* Main Workspace */}
          <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
            {/* Context Header */}
            <header className="h-20 border-b border-black/[0.04] flex items-center justify-between px-10 bg-white/30 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => window.history.back()}
                  className="w-10 h-10 flex items-center justify-center text-black/20 hover:text-black transition-all rounded-2xl hover:bg-black/5 border border-transparent hover:border-black/5"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/20 leading-none">
                      Knowledge Unit
                    </span>
                    <span className="w-1 h-1 rounded-full bg-black/10" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 leading-none">
                      {docInfo?.type || "Document"}
                    </span>
                  </div>
                  <h1 className="text-lg font-black text-black tracking-tight leading-none mt-2">
                    {materialTitle}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest">
                    Synced to Cloud
                  </span>
                </div>

                <div className="w-px h-6 bg-black/[0.06] mx-1" />

                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className={`flex items-center gap-2.5 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    sidebarOpen
                      ? "bg-black text-white shadow-2xl shadow-black/20 scale-105"
                      : "bg-black/5 text-black/40 hover:bg-black/10 hover:text-black"
                  }`}
                >
                  <Sparkles
                    className={`w-3.5 h-3.5 ${sidebarOpen ? "animate-pulse" : ""}`}
                  />
                  AI Co-Pilot
                </button>
              </div>
            </header>

            {/* Content Area */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Panel: Material/Reading */}
              <AnimatePresence mode="wait">
                {(viewMode === "read" || viewMode === "dual") && (
                  <motion.div
                    key="reading-wing"
                    initial={{ width: 0, opacity: 0, x: -20 }}
                    animate={{
                      width: viewMode === "read" ? "100%" : "50%",
                      opacity: 1,
                      x: 0,
                    }}
                    exit={{ width: 0, opacity: 0, x: -20 }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full border-r border-black/[0.04] bg-white/40 relative overflow-hidden"
                  >
                    <MaterialViewer title={materialTitle} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Center Panel: The Editor */}
              <motion.div
                layout
                className={`h-full flex-1 overflow-y-auto custom-scrollbar relative bg-white/10 ${
                  viewMode === "read" ? "hidden" : "block"
                }`}
              >
                <div
                  className={`max-w-4xl mx-auto py-20 px-10 md:px-16 lg:px-24 transition-all duration-700 ${viewMode === "notes" ? "scale-100" : "scale-[0.98] opacity-90"}`}
                >
                  <Editor
                    documentId={id}
                    title={title}
                    setTitle={setTitle}
                    showToolbar={true}
                  />
                </div>
              </motion.div>

              {/* Right Sidebar: AI Chat */}
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.aside
                    initial={{ width: 0, opacity: 0, x: 30 }}
                    animate={{ width: 440, opacity: 1, x: 0 }}
                    exit={{ width: 0, opacity: 0, x: 30 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full border-l border-black/[0.04] bg-white/60 backdrop-blur-3xl shrink-0 z-40 flex flex-col overflow-hidden shadow-2xl shadow-black/[0.02]"
                  >
                    <ChatSidebarWithNoteTarget
                      onClose={() => setSidebarOpen(false)}
                    />
                  </motion.aside>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </NoteExtractionProviderWithUser>
    </EditorProvider>
  );
}

function ChatSidebarWithNoteTarget({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="p-8 pb-4 flex items-center justify-between shrink-0">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/30">
              Intelligence System
            </span>
          </div>
          <h2 className="text-xl font-black text-black mt-2 tracking-tight">
            AI Co-Pilot
          </h2>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center text-black/10 hover:text-black transition-all hover:bg-black/5 rounded-2xl border border-transparent hover:border-black/5"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 min-h-0">
        <ChatSidebar />
      </div>

      <div className="p-8 border-t border-black/[0.04] bg-black/[0.01]">
        <div className="group p-6 rounded-[32px] bg-white border border-black/[0.04] shadow-xl shadow-black/[0.02] hover:shadow-2xl hover:shadow-black/[0.04] transition-all cursor-help relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-violet-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-violet-500">
                AI Suggestion
              </span>
            </div>
            <p className="text-xs text-black/60 leading-relaxed font-bold italic">
              "根据您选中的知识点，我建议可以从『底层逻辑』和『实际应用』两个维度进行深度挖掘。需要我为您生成相关的思维导图吗？"
            </p>
          </div>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-violet-500/5 rounded-full blur-2xl group-hover:bg-violet-500/10 transition-colors" />
        </div>
      </div>
    </div>
  );
}

function NoteExtractionProviderWithUser({
  children,
  documentId,
}: {
  children: React.ReactNode;
  documentId: string;
}) {
  return (
    <NoteExtractionProvider>
      <NoteExtractionInitializer>{children}</NoteExtractionInitializer>
    </NoteExtractionProvider>
  );
}

function NoteExtractionInitializer({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const { setUserId } = useNoteExtraction();
  useEffect(() => {
    if (session?.user?.id) setUserId(session.user.id);
  }, [session?.user?.id, setUserId]);
  return <>{children}</>;
}
