"use client";
import { useEffect, useState } from "react";
import { PendingTagsPopover } from "./PendingTagsPopover";
import { TagBadge } from "./TagBadge";

interface NoteTag {
  id: string;
  confidence: number;
  status: string;
  confirmedAt: string | null;
  tag: { id: string; name: string; usageCount: number };
}
interface TagBarProps {
  noteId: string;
}

export function TagBar({ noteId }: TagBarProps) {
  const [tags, setTags] = useState<NoteTag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTags = async () => {
    try {
      const res = await fetch(`/api/notes/${noteId}/tags`);
      const data = await res.json();
      setTags(data.tags || []);
    } catch (e) {
      console.error("[TagBar] 获取标签失败:", e);
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchTags is intentionally not wrapped in useCallback; we refetch when note changes
  useEffect(() => {
    fetchTags();
  }, [noteId]);

  const handleConfirm = async (noteTagId: string) => {
    await fetch(`/api/note-tags/${noteTagId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    await fetchTags();
  };

  const handleReject = async (noteTagId: string) => {
    await fetch(`/api/note-tags/${noteTagId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    });
    await fetchTags();
  };

  const handleRemove = async (noteTagId: string) => {
    await fetch(`/api/note-tags/${noteTagId}`, { method: "DELETE" });
    await fetchTags();
  };

  if (loading)
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="h-6 w-16 bg-muted animate-pulse rounded-md" />
        <div className="h-6 w-12 bg-muted animate-pulse rounded-md" />
      </div>
    );

  const confirmed = tags.filter((t) => t.status === "confirmed");
  const pending = tags.filter((t) => t.status === "pending");
  if (confirmed.length === 0 && pending.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      {confirmed.map((dt) => (
        <TagBadge key={dt.id} name={dt.tag.name} removable onRemove={() => handleRemove(dt.id)} />
      ))}
      <PendingTagsPopover pending={pending} onConfirm={handleConfirm} onReject={handleReject} />
    </div>
  );
}
