/**
 * LearnEditor - Chapter content display wrapper for the Editor component
 *
 * Wraps the Editor component and displays the current chapter's content
 * with support for zen mode layout and content change animations.
 */

"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Editor } from "@/components/editor";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";

interface ChapterDoc {
  id: string;
  title: string | null;
  content: Buffer | null;
  outlineNodeId: string | null;
}

interface LearnEditorProps {
  chapterDocs: ChapterDoc[];
}

export function LearnEditor({ chapterDocs }: LearnEditorProps) {
  const { currentChapterIndex, isZenMode } = useLearnStore();
  const [loading, setLoading] = useState(false);
  const [editorContent, setEditorContent] = useState<string>("");

  // Find the current chapter doc from chapterDocs
  const currentChapterDoc = chapterDocs[currentChapterIndex];

  // Parse content Buffer to JSON string for Editor
  useEffect(() => {
    setLoading(true);

    // Simulate brief loading state when switching chapters
    const timer = setTimeout(() => {
      if (currentChapterDoc?.content) {
        // Buffer is stored as an object with type and data
        // Convert Buffer to string
        const bufferData = currentChapterDoc.content as
          | Buffer
          | { type: string; data: number[] }
          | string;
        let contentString = "";

        if (Buffer.isBuffer(bufferData)) {
          contentString = bufferData.toString("utf-8");
        } else if (
          bufferData &&
          typeof bufferData === "object" &&
          "type" in bufferData &&
          (bufferData as { type: string }).type === "Buffer" &&
          "data" in bufferData
        ) {
          // Handle serialized Buffer format
          const buffer = Buffer.from((bufferData as { data: number[] }).data);
          contentString = buffer.toString("utf-8");
        } else if (typeof bufferData === "string") {
          contentString = bufferData;
        }

        setEditorContent(contentString || "");
      } else {
        setEditorContent("");
      }
      setLoading(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [currentChapterDoc, currentChapterIndex]);

  // Handle content change - TODO: implement auto-save
  const handleContentChange = useCallback((html: string) => {
    // TODO: Implement auto-save functionality
    console.log("Content changed, auto-save pending implementation");
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    );
  }

  // Editor with animation
  return (
    <motion.div
      key={currentChapterIndex}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className={cn("h-full", isZenMode ? "max-w-3xl mx-auto px-8 py-12" : "p-6")}
    >
      <Editor content={editorContent} onChange={handleContentChange} placeholder="章节内容..." />
    </motion.div>
  );
}

export default LearnEditor;
