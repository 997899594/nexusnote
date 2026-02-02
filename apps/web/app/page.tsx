"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { BookOpen, FileText } from "lucide-react";
import { motion } from "framer-motion";
import {
  learningStore,
  LocalLearningContent,
  LocalLearningProgress,
} from "@/lib/storage";
import { HeroInput } from "@/components/demo/HeroInput";
import { RecentAccess } from "@/components/demo/RecentAccess";
import { OrganicHeader } from "@/components/create/OrganicHeader";

// Interface for Notes fetched from API
interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  tags?: string[];
}

interface CourseWithProgress extends LocalLearningContent {
  progress?: LocalLearningProgress;
}

export default function Home() {
  const router = useRouter();
  const { data: session } = useSession();
  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [session?.user?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load Courses (Local-First)
      const contents = await learningStore.getAllContents();
      const coursesWithProgress: CourseWithProgress[] = [];

      for (const content of contents) {
        const progress = await learningStore.getProgress(content.id);
        coursesWithProgress.push({ ...content, progress });
      }

      // Sort by last accessed
      coursesWithProgress.sort((a, b) => {
        const aTime = a.progress?.lastAccessedAt || a.createdAt;
        const bTime = b.progress?.lastAccessedAt || b.createdAt;
        return bTime - aTime;
      });
      setCourses(coursesWithProgress);

      // 2. Load Notes (Server-First)
      const userId = session?.user?.id;
      if (userId) {
        const response = await fetch(`/api/notes/topics?userId=${encodeURIComponent(userId)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.topics) {
            const allNotes: Note[] = [];
            data.topics.forEach((topic: any) => {
              if (topic.notes) {
                allNotes.push(...topic.notes);
              }
            });
            allNotes.sort(
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            );
            setNotes(allNotes);
          }
        }
      }
    } catch (error) {
      console.error("Failed to load hub data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (timestamp: number | string) => {
    const time =
      typeof timestamp === "number" ? timestamp : new Date(timestamp).getTime();
    const seconds = Math.floor((Date.now() - time) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const recentItems = useMemo(() => {
    const items = [
      ...courses.map((c) => ({
        id: c.id,
        title: c.title,
        type: "course" as const,
        date: c.progress?.lastAccessedAt
          ? formatTimeAgo(c.progress.lastAccessedAt)
          : "New",
        icon: <BookOpen className="w-5 h-5" />,
        onClick: () => router.push(`/editor/${c.id}`),
      })),
      ...notes.map((n) => ({
        id: n.id,
        title: n.title || "Untitled Note",
        type: "note" as const,
        date: formatTimeAgo(n.createdAt),
        icon: <FileText className="w-5 h-5" />,
        onClick: () => {
          /* Navigate to note view if available */
        },
      })),
    ];

    // Sort combined items by date (heuristic: just take top 6 from interleaved or re-sort)
    // For now, let's just take the first few of each or sort them if possible
    return items.slice(0, 6);
  }, [courses, notes, router]);

  return (
    <div className="min-h-screen bg-[#FDFDFD] relative overflow-hidden font-sans selection:bg-black/10 selection:text-black">
      {/* Organic Noise Texture */}
      <div
        className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Subtle Gradient Spot */}
      <div className="absolute top-[-20%] left-[20%] w-[60%] h-[60%] bg-gradient-to-b from-blue-50/50 to-transparent blur-[120px] rounded-full pointer-events-none" />

      <OrganicHeader />

      <main className="relative z-10 flex flex-col items-center pt-[18vh] md:pt-[20vh] px-4 md:px-6 w-full max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-8 md:mb-12 w-full"
        >
          <h1 className="text-4xl md:text-6xl font-bold text-black tracking-tight mb-4 leading-[1.1]">
            What do you want to <span className="text-black/30">know</span>?
          </h1>
        </motion.div>

        <div className="w-full max-w-3xl">
          <HeroInput />
        </div>

        <div className="mt-8 md:mt-16 w-full max-w-3xl">
          <RecentAccess items={recentItems} loading={loading} />
        </div>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-6 w-full text-center text-black/20 text-[10px] font-mono uppercase tracking-widest z-10 hidden md:block">
        AI Native OS • v3.0.0
      </footer>
    </div>
  );
}
