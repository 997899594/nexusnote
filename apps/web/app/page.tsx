"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { BookOpen, FileText, Zap } from "lucide-react";
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
      const contents = await learningStore.getAllContents();
      const coursesWithProgress: CourseWithProgress[] = [];

      for (const content of contents) {
        const progress = await learningStore.getProgress(content.id);
        coursesWithProgress.push({ ...content, progress });
      }

      coursesWithProgress.sort((a, b) => {
        const aTime = a.progress?.lastAccessedAt || a.createdAt;
        const bTime = b.progress?.lastAccessedAt || b.createdAt;
        return bTime - aTime;
      });
      setCourses(coursesWithProgress);

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
      router.push(`/learn/${item.id}`);
    } else {
      router.push(`/editor/${item.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden font-sans selection:bg-primary/10 selection:text-foreground">
      <div
        className="absolute inset-0 z-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="absolute top-[-20%] left-[20%] w-[60%] h-[60%] bg-gradient-to-b from-primary/5 to-transparent blur-[120px] rounded-full pointer-events-none" />

      <OrganicHeader />

      <main className="relative z-10 flex flex-col items-center pt-[clamp(10vh,15vh,20vh)] px-4 md:px-6 w-full max-w-7xl mx-auto pb-safe-bottom">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-[clamp(2rem,4vh,3rem)] w-full"
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground fill-primary-foreground" />
            </div>
            <span className="text-[clamp(0.625rem,0.8vw,0.75rem)] font-black uppercase tracking-[0.3em] text-foreground/40">
              NexusNote
            </span>
          </div>

          <h1 className="font-black text-foreground tracking-tight leading-[1.05] mb-4">
            <span className="block text-[clamp(2.5rem,8vw,5rem)]">
              你想学习
            </span>
            <span className="block text-[clamp(2rem,6.5vw,4.5rem)] text-foreground/30">
              什么？
            </span>
          </h1>

          <p className="text-[clamp(0.875rem,1.5vw,1.125rem)] text-foreground/60 max-w-2xl mx-auto leading-relaxed">
            AI 原生的知识内化平台，让学习变得自然流畅
          </p>
        </motion.div>

        <div className="w-full max-w-3xl mb-[clamp(2rem,5vh,4rem)]">
          <HeroInput />
        </div>

        <div className="w-full max-w-6xl">
          <RecentAccess
            items={recentItems}
            loading={loading}
            onItemClick={handleItemClick}
          />
        </div>
      </main>

      <footer className="absolute bottom-6 w-full text-center text-foreground/20 text-[10px] font-mono uppercase tracking-widest z-10 hidden md:block">
        AI Native OS • v3.0.0
      </footer>
    </div>
  );
}
