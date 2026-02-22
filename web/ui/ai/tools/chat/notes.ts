/**
 * Chat Tools - 笔记 CRUD
 */

import { db, documents, eq } from "@/db";
import { tool } from "ai";
import { z } from "zod";

export const CreateNoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().default(""),
});

export type CreateNoteInput = z.infer<typeof CreateNoteSchema>;

export const createNoteTool = tool({
  description: "创建新笔记",
  inputSchema: CreateNoteSchema,
  execute: async (args) => {
    try {
      const [note] = await db
        .insert(documents)
        .values({
          title: args.title,
          plainText: args.content,
        })
        .returning();

      return {
        success: true,
        id: note.id,
        title: note.title,
      };
    } catch (error) {
      console.error("[Tool] createNote error:", error);
      return { success: false, error: "创建笔记失败" };
    }
  },
});

export const GetNoteSchema = z.object({
  noteId: z.string().uuid(),
});

export const getNoteTool = tool({
  description: "获取笔记详情",
  inputSchema: GetNoteSchema,
  execute: async (args) => {
    try {
      const note = await db.query.documents.findFirst({
        where: eq(documents.id, args.noteId),
      });

      if (!note) {
        return { success: false, error: "笔记不存在" };
      }

      return {
        success: true,
        id: note.id,
        title: note.title,
        content: note.plainText,
        updatedAt: note.updatedAt,
      };
    } catch (error) {
      console.error("[Tool] getNote error:", error);
      return { success: false, error: "获取笔记失败" };
    }
  },
});

export const UpdateNoteSchema = z.object({
  noteId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
});

export const updateNoteTool = tool({
  description: "更新笔记",
  inputSchema: UpdateNoteSchema,
  execute: async (args) => {
    try {
      await db
        .update(documents)
        .set({
          ...(args.title && { title: args.title }),
          ...(args.content && { plainText: args.content }),
          updatedAt: new Date(),
        })
        .where(eq(documents.id, args.noteId));

      return { success: true, id: args.noteId };
    } catch (error) {
      console.error("[Tool] updateNote error:", error);
      return { success: false, error: "更新笔记失败" };
    }
  },
});

export const DeleteNoteSchema = z.object({
  noteId: z.string().uuid(),
});

export const deleteNoteTool = tool({
  description: "删除笔记",
  inputSchema: DeleteNoteSchema,
  execute: async (args) => {
    try {
      await db.delete(documents).where(eq(documents.id, args.noteId));
      return { success: true, id: args.noteId };
    } catch (error) {
      console.error("[Tool] deleteNote error:", error);
      return { success: false, error: "删除笔记失败" };
    }
  },
});
