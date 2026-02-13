"use client";

import { useState, useEffect, use } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Book, Edit3, Split, Sparkles, X, Layout, Menu, ChevronLeft } from "lucide-react";
import { Editor } from "@/features/editor/components/Editor";
import { MaterialViewer } from "@/features/editor/components/workpanel/MaterialViewer";
import { ChatSidebar } from "@/features/chat/components/ai/ChatSidebar";
import { useNoteExtraction } from "@/lib/store";
import { useSession } from "next-auth/react";
import { getDocumentAction } from "@/features/editor/actions/document";
import { cn } from "@/lib/utils";

type ViewMode = "read" | "dual" | "notes";

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
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
  const { setUserId, setIsSidebarOpen } = useNoteExtraction();

  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);

  const leftSidebarX = useMotionValue(0);
  const rightSidebarX = useMotionValue(0);

  const leftSidebarWidth = 280;
  const rightSidebarWidth = 360;

  const leftSidebarLeft = useTransform(leftSidebarX, (x) => x);
  const rightSidebarRight = useTransform(rightSidebarX, (x) => -x);

  const handleLeftDragEnd = (_: any, info: PanInfo) => {
    const threshold = 100;
    if (info.offset.x > threshold) {
      setLeftSidebarOpen(false);
    } else {
      leftSidebarX.set(0);
    }
  };

  const handleRightDragEnd = (_: any, info: PanInfo) => {
    const threshold = 100;
    if (info.offset.x < -threshold) {
      setRightSidebarOpen(false);
    } else {
      rightSidebarX.set(0);
    }
  };

  const closeLeftSidebar = () => {
    setLeftSidebarOpen(false);
    leftSidebarX.set(0);
  };

  const closeRightSidebar = () => {
    setRightSidebarOpen(false);
    rightSidebarX.set(0);
  };

  useEffect(() => {
    if (session?.user?.id) {
      setUserId(session.user.id);
    }
  }, [session?.user?.id, setUserId]);

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
    <div className="h-screen bg-background overflow-hidden flex font-sans">
      <LeftDrawer
        isOpen={leftSidebarOpen}
        onClose={closeLeftSidebar}
        viewMode={viewMode}
        setViewMode={setViewMode}
        dragX={leftSidebarX}
        onDragEnd={handleLeftDragEnd}
      />

      <RightDrawer
        isOpen={rightSidebarOpen}
        onClose={closeRightSidebar}
        dragX={rightSidebarX}
        onDragEnd={handleRightDragEnd}
      />

      <main className="flex-1 flex flex-col relative min-w-0">
        <EditorHeader
          title={materialTitle}
          docInfo={docInfo}
          onMenuClick={() => setLeftSidebarOpen(true)}
          onAIClick={() => setRightSidebarOpen(true)}
          isAIOpen={rightSidebarOpen}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />

        <div className="flex-1 flex overflow-hidden">
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
                className="h-full border-r border-black/5 bg-surface-50/30 relative overflow-hidden"
              >
                <MaterialViewer title={materialTitle} />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            layout
            className={cn(
              "h-full flex-1 overflow-y-auto custom-scrollbar relative bg-background/50",
              viewMode === "read" && "hidden"
            )}
          >
            <div
              className={cn(
                "max-w-4xl mx-auto py-20 px-6 md:px-16 lg:px-24 pb-safe-bottom transition-all duration-700",
                viewMode === "notes" ? "scale-100" : "scale-[0.98] opacity-90"
              )}
            >
              <Editor documentId={id} title={title} setTitle={setTitle} showToolbar={true} />
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

function LeftDrawer({
  isOpen,
  onClose,
  viewMode,
  setViewMode,
  dragX,
  onDragEnd,
}: {
  isOpen: boolean;
  onClose: () => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  dragX: any;
  onDragEnd: any;
}) {
  const navItems = [
    { id: "notes" as ViewMode, icon: Edit3, label: "编辑笔记" },
    { id: "dual" as ViewMode, icon: Split, label: "对照模式" },
    { id: "read" as ViewMode, icon: Book, label: "沉浸阅读" },
  ];

  return (
    <>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}
      <motion.aside
        drag="x"
        dragConstraints={{ left: -280, right: 0 }}
        dragElastic={0.1}
        dragMomentum={false}
        style={{ x: dragX }}
        onDragEnd={onDragEnd}
        initial={isOpen ? false : { x: -280 }}
        animate={{ x: isOpen ? 0 : -280 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "fixed left-0 top-0 bottom-0 z-50 bg-surface-50/95 backdrop-blur-xl border-r border-black/5 shadow-glass flex flex-col",
          "hidden md:flex md:static md:shadow-none md:backdrop-blur-none",
          "w-[280px] md:w-20"
        )}
      >
        <div className="h-16 flex items-center justify-between px-4 md:justify-center md:px-0 border-b border-black/5">
          <button
            onClick={() => (window.location.href = "/")}
            className="hidden md:flex w-12 h-12 rounded-xl bg-primary items-center justify-center text-primary-foreground shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
          >
            <Layout className="w-5 h-5" />
          </button>
          <span className="md:hidden font-bold text-lg text-foreground">NexusNote</span>
          <button
            onClick={onClose}
            className="md:hidden p-2 rounded-lg hover:bg-black/5 text-foreground/60"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 md:p-4 space-y-1 md:space-y-3 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = viewMode === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setViewMode(item.id);
                  onClose();
                }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 md:w-12 md:h-12 md:justify-center md:px-0 rounded-xl transition-all duration-200 relative group",
                  isActive
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-foreground/70 hover:bg-black/5 hover:text-foreground md:text-foreground/40 md:hover:text-foreground/60"
                )}
              >
                <item.icon className="w-5 h-5 md:w-5 md:h-5" />
                <span className="md:hidden">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="active-view-indicator"
                    className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-full"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 md:p-0 border-t border-black/5">
          <div className="hidden md:flex w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/10 to-emerald-500/10 border border-black/5 items-center justify-center overflow-hidden mx-auto">
            <Sparkles className="w-4 h-4 text-foreground/40" />
          </div>
        </div>
      </motion.aside>
    </>
  );
}

function RightDrawer({
  isOpen,
  onClose,
  dragX,
  onDragEnd,
}: {
  isOpen: boolean;
  onClose: () => void;
  dragX: any;
  onDragEnd: any;
}) {
  return (
    <>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}
      <motion.aside
        drag="x"
        dragConstraints={{ left: 0, right: 360 }}
        dragElastic={0.1}
        dragMomentum={false}
        style={{ x: dragX }}
        onDragEnd={onDragEnd}
        initial={isOpen ? false : { x: 360 }}
        animate={{ x: isOpen ? 0 : 360 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "fixed right-0 top-0 bottom-0 z-50 bg-surface-50/95 backdrop-blur-xl border-l border-black/5 shadow-glass flex flex-col overflow-hidden",
          "hidden md:flex md:static md:shadow-none md:backdrop-blur-none",
          "w-[360px] md:w-[440px]"
        )}
      >
        <div className="p-4 md:p-8 flex items-center justify-between shrink-0 border-b border-black/5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30 md:hidden">
              AI Co-Pilot
            </span>
            <span className="hidden md:flex text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">
              Intelligence System
            </span>
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-2 rounded-lg hover:bg-black/5 text-foreground/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <ChatSidebar />
        </div>

        <div className="hidden md:block p-8 border-t border-black/5 bg-black/[0.01]">
          <div className="p-6 rounded-2xl bg-background border border-black/5 shadow-glass hover:shadow-glass-lg transition-all">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                AI Suggestion
              </span>
            </div>
            <p className="text-xs text-foreground/60 leading-relaxed font-bold italic">
              "根据您选中的知识点，我建议可以从『底层逻辑』和『实际应用』两个维度进行深度挖掘。"
            </p>
          </div>
        </div>
      </motion.aside>
    </>
  );
}

function EditorHeader({
  title,
  docInfo,
  onMenuClick,
  onAIClick,
  isAIOpen,
  viewMode,
  setViewMode,
}: {
  title: string;
  docInfo: { id: string; title: string; isVault: boolean; type?: string } | null;
  onMenuClick: () => void;
  onAIClick: () => void;
  isAIOpen: boolean;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}) {
  return (
    <header className="h-16 border-b border-black/5 flex items-center justify-between px-4 md:px-10 bg-surface-50/50 backdrop-blur-md shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-3 md:gap-6">
        <button
          onClick={() => window.history.back()}
          className="hidden md:flex w-10 h-10 flex items-center justify-center text-foreground/20 hover:text-foreground transition-all rounded-xl hover:bg-black/5 border border-transparent hover:border-black/5"
        >
          <X className="w-4 h-4" />
        </button>
        <button
          onClick={onMenuClick}
          className="md:hidden flex w-10 h-10 flex items-center justify-center text-foreground/60 hover:text-foreground transition-all rounded-xl hover:bg-black/5 border border-transparent hover:border-black/5"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/20 leading-none hidden sm:flex">
              Knowledge Unit
            </span>
            <span className="w-1 h-1 rounded-full bg-foreground/10 hidden sm:block" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary leading-none">
              {docInfo?.type || "Document"}
            </span>
          </div>
          <h1 className="text-sm md:text-lg font-black text-foreground tracking-tight leading-none mt-1 truncate">
            {title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-xl border border-primary/10">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
          <span className="text-[10px] font-black text-primary/60 uppercase tracking-widest">
            Synced to Cloud
          </span>
        </div>

        <button
          onClick={onAIClick}
          className={cn(
            "flex items-center gap-2 md:gap-2.5 px-4 md:px-6 py-2 md:py-2.5 rounded-xl text-[10px] md:text-[10px] font-black uppercase tracking-widest transition-all touch-safe",
            isAIOpen
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
              : "bg-black/5 text-foreground/40 hover:bg-black/10 hover:text-foreground"
          )}
        >
          <Sparkles className={cn("w-3.5 h-3.5", isAIOpen && "animate-pulse")} />
          <span className="hidden md:inline">AI Co-Pilot</span>
        </button>
      </div>
    </header>
  );
}
