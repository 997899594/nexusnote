import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { courseSections, courses, db } from "@/db";
import { tagGenerationService } from "@/lib/ai/services/tag-generation-service";
import { auth } from "@/lib/auth";
import { parseSectionOutlineNodeKey } from "@/lib/learning/outline-node-key";
import {
  buildCapturedNoteHtml,
  buildCapturedNotePlainText,
  buildCapturedNoteTitle,
  serializeCaptureAnchor,
} from "@/lib/notes/capture";
import { createOwnedNote } from "@/lib/notes/write-service";

const CaptureNoteSchema = z.object({
  sectionId: z.string().uuid(),
  selectionText: z.string().min(1).max(5000),
  anchor: z.object({
    textContent: z.string(),
    startOffset: z.number(),
    endOffset: z.number(),
  }),
  noteContent: z.string().max(5000).optional(),
  annotationId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = CaptureNoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { sectionId, selectionText, anchor, noteContent, annotationId } = parsed.data;

    const [section] = await db
      .select({
        sectionId: courseSections.id,
        sectionTitle: courseSections.title,
        outlineNodeKey: courseSections.outlineNodeKey,
        courseId: courses.id,
        courseTitle: courses.title,
      })
      .from(courseSections)
      .innerJoin(courses, eq(courseSections.courseId, courses.id))
      .where(and(eq(courseSections.id, sectionId), eq(courses.userId, userId)))
      .limit(1);

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    const parsedSectionKey = parseSectionOutlineNodeKey(section.outlineNodeKey);
    const chapterIndex = parsedSectionKey?.chapterIndex;

    const plainText = buildCapturedNotePlainText({
      courseTitle: section.courseTitle,
      sectionTitle: section.sectionTitle,
      selectionText,
      noteContent,
    });
    const contentHtml = buildCapturedNoteHtml({
      courseTitle: section.courseTitle,
      sectionTitle: section.sectionTitle,
      selectionText,
      noteContent,
    });

    const note = await createOwnedNote({
      userId,
      title: buildCapturedNoteTitle({
        sectionTitle: section.sectionTitle,
        selectionText,
      }),
      sourceType: "course_capture",
      sourceContext: {
        courseId: section.courseId,
        courseTitle: section.courseTitle,
        sectionId: section.sectionId,
        sectionTitle: section.sectionTitle,
        chapterIndex: chapterIndex ?? undefined,
        selectionText,
        anchor: serializeCaptureAnchor(anchor),
        annotationId,
        noteContent: noteContent?.trim() || undefined,
      },
      content: {
        kind: "both",
        contentHtml,
        plainText,
      },
    });

    try {
      await tagGenerationService.generateTags(note.id);
    } catch (error) {
      console.error("[Notes Capture] Failed to generate tags:", error);
    }

    return NextResponse.json({
      success: true,
      note: {
        id: note.id,
        title: note.title,
      },
    });
  } catch (error) {
    console.error("[Notes Capture] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
