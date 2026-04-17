/**
 * Chat Tools - 笔记 CRUD (带权限验证)
 */

import { tool } from "ai";
import { z } from "zod";
import { getOwnedNote } from "@/lib/notes/repository";
import { createOwnedNote, deleteOwnedNote, updateOwnedNote } from "@/lib/notes/write-service";

export const CreateNoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().default(""),
});

export type CreateNoteInput = z.infer<typeof CreateNoteSchema>;

export const GetNoteSchema = z.object({
  noteId: z.string().uuid(),
});

export const UpdateNoteSchema = z.object({
  noteId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
});

export const DeleteNoteSchema = z.object({
  noteId: z.string().uuid(),
});

/**
 * 创建笔记工具集（绑定 userId，带权限验证）
 */
export function createNoteTools(userId: string) {
  return {
    createNote: tool({
      description: "创建新笔记",
      inputSchema: CreateNoteSchema,
      execute: async (args) => {
        try {
          const note = await createOwnedNote({
            userId,
            title: args.title,
            content: {
              kind: "plainText",
              plainText: args.content,
            },
          });

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
    }),

    getNote: tool({
      description: "获取笔记详情",
      inputSchema: GetNoteSchema,
      execute: async (args) => {
        try {
          const note = await getOwnedNote(args.noteId, userId);

          if (!note) {
            return { success: false, error: "笔记不存在或无权访问" };
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
    }),

    updateNote: tool({
      description: "更新笔记",
      inputSchema: UpdateNoteSchema,
      execute: async (args) => {
        try {
          const note = await updateOwnedNote({
            noteId: args.noteId,
            userId,
            ...(args.title !== undefined && { title: args.title }),
            ...(args.content !== undefined && {
              content: {
                kind: "plainText",
                plainText: args.content,
              } as const,
            }),
          });

          if (!note) {
            return { success: false, error: "笔记不存在或无权修改" };
          }

          return { success: true, id: args.noteId };
        } catch (error) {
          console.error("[Tool] updateNote error:", error);
          return { success: false, error: "更新笔记失败" };
        }
      },
    }),

    deleteNote: tool({
      description: "删除笔记",
      inputSchema: DeleteNoteSchema,
      execute: async (args) => {
        try {
          const deleted = await deleteOwnedNote(args.noteId, userId);

          if (!deleted) {
            return { success: false, error: "笔记不存在或无权删除" };
          }
          return { success: true, id: args.noteId };
        } catch (error) {
          console.error("[Tool] deleteNote error:", error);
          return { success: false, error: "删除笔记失败" };
        }
      },
    }),
  };
}
