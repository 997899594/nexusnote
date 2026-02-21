"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getNoteTopicsAction } from "@/features/learning/actions/note";
import { OrganicHeader } from "@/features/learning/components/create/OrganicHeader";
import { HeroInput } from "@/features/shared/components/home/HeroInput";
import { RecentAccess } from "@/features/shared/components/home/RecentAccess";
import type { NoteDTO, RecentItemDTO } from "@/lib/actions/types";
import {
  type LocalLearningContent,
  type LocalLearningProgress,
  learningStore,
} from "@/lib/storage";

interface CourseWithProgress extends LocalLearningContent {
  progress?: LocalLearningProgress;
}

export default function Home() {
  const router = useRouter();
  const { data: session } = useSession();
  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [notes, setNotes] = useState<NoteDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
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
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
          setNotes(allNotes);
        }
      }
    } catch (error) {
      console.error("Failed to load hub data:", error);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const recentItems = useMemo((): RecentItemDTO[] => {
    const items: RecentItemDTO[] = [];

    courses.forEach((c) => {
      items.push({
        id: c.id,
        title: c.title,
        type: "course",
        updatedAt: new Date(c.progress?.lastAccessedAt || c.createdAt).toISOString(),
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
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
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
    <div className="bg-background relative font-sans selection:bg-primary/10 selection:text-foreground">
      <div
        className="absolute inset-0 z-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="absolute top-[-20%] left-[20%] w-[60%] h-[60%] bg-gradient-to-b from-primary/5 to-transparent blur-[120px] rounded-full pointer-events-none" />

      <OrganicHeader />

      <main className="relative z-10 flex items-center justify-center px-4 md:px-6 w-full h-screen [-webkit-mask-image:linear-gradient(to_bottom,black_50%,transparent_100%)]">
        <div className="w-full max-w-3xl -mt-16">
          <HeroInput />
        </div>
      </main>

      {/* Bottom fixed section with recent items */}
      <div className="fixed bottom-0 left-0 right-0 z-20 px-4 md:px-6 pb-4 pt-8 bg-gradient-to-t from-background via-background to-transparent">
        <div className="w-full max-w-4xl mx-auto">
          <RecentAccess items={recentItems} loading={loading} onItemClick={handleItemClick} />
        </div>
        <footer className="mt-4 w-full text-center text-foreground/20 text-[10px] font-mono uppercase tracking-widest">
          AI Native OS • v3.0.0
        </footer>
      </div>
    </div>
  );
}
