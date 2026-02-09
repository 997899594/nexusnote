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
import { OrganicHeader } from "@/components/create/OrganicHeader";
import { HeroInput } from "@/components/home/HeroInput";
import { RecentAccess } from "@/components/home/RecentAccess";
import { getNoteTopicsAction } from "@/app/actions/note";
import { NoteDTO, RecentItemDTO } from "@/lib/actions/types";

interface CourseWithProgress extends LocalLearningContent {
  progress?: LocalLearningProgress;
}

export default function Home() {
  const router = useRouter();
  const { data: session } = useSession();
  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [notes, setNotes] = useState<NoteDTO[]>([]);
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
        const result = await getNoteTopicsAction();
        if (result.success && result.data?.topics) {
          const allNotes: NoteDTO[] = [];
          result.data.topics.forEach((topic) => {
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
    } catch (error) {
      console.error("Failed to load hub data:", error);
    } finally {
      setLoading(false);
    }
  };

  const recentItems = useMemo((): RecentItemDTO[] => {
    const items: RecentItemDTO[] = [];

    courses.forEach((c) => {
      items.push({
        id: c.id,
        title: c.title,
        type: "course",
        updatedAt: new Date(
          c.progress?.lastAccessedAt || c.createdAt,
        ).toISOString(),
      });
    });

    notes.forEach((n) => {
      items.push({
        id: n.id,
        title: n.title || "Untitled Note",
        type: "note",
        updatedAt: new Date(n.createdAt).toISOString(),
      });
    });

    return items
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
      .slice(0, 8);
  }, [courses, notes]);

  const handleItemClick = (item: RecentItemDTO) => {
    if (item.type === "course") {
      // 课程跳转到学习页面
      router.push(`/learn/${item.id}`);
    } else {
      // 笔记跳转到编辑器页面
      router.push(`/editor/${item.id}`);
    }
  };

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
          <RecentAccess
            items={recentItems}
            loading={loading}
            onItemClick={handleItemClick}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-6 w-full text-center text-black/20 text-[10px] font-mono uppercase tracking-widest z-10 hidden md:block">
        AI Native OS • v3.0.0
      </footer>
    </div>
  );
}
