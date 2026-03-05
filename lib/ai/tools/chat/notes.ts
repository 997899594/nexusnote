/**
 * Chat Tools - 笔记 CRUD (带权限验证)
 */

import { tool } from "ai";
import { z } from "zod";
import { and, db, documents, eq, workspaces } from "@/db";

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
 * 通过 workspace.ownerId 验证文档所有权
 */
export function createNoteTools(userId: string) {
  return {
    createNote: tool({
      description: "创建新笔记（需要用户有 workspace）",
      inputSchema: CreateNoteSchema,
      execute: async (args) => {
        try {
          // 获取用户的 workspace
          const workspace = await db.query.workspaces.findFirst({
            where: eq(workspaces.ownerId, userId),
          });

          if (!workspace) {
            return { success: false, error: "用户没有可用的 workspace" };
          }

          const [note] = await db
            .insert(documents)
            .values({
              title: args.title,
              plainText: args.content,
              workspaceId: workspace.id,
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
    }),

    getNote: tool({
      description: "获取笔记详情",
      inputSchema: GetNoteSchema,
      execute: async (args) => {
        try {
          // 验证所有权：通过 workspace.ownerId
          const note = await db.query.documents.findFirst({
            where: eq(documents.id, args.noteId),
            with: {
              workspace: true,
            },
          });

          if (!note || note.workspace?.ownerId !== userId) {
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
          // 验证所有权：通过 workspace.ownerId
          const existing = await db.query.documents.findFirst({
            where: eq(documents.id, args.noteId),
            with: {
              workspace: true,
            },
          });

          if (!existing || existing.workspace?.ownerId !== userId) {
            return { success: false, error: "笔记不存在或无权修改" };
          }

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
    }),

    deleteNote: tool({
      description: "删除笔记",
      inputSchema: DeleteNoteSchema,
      execute: async (args) => {
        try {
          // 验证所有权：通过 workspace.ownerId
          const existing = await db.query.documents.findFirst({
            where: eq(documents.id, args.noteId),
            with: {
              workspace: true,
            },
          });

          if (!existing || existing.workspace?.ownerId !== userId) {
            return { success: false, error: "笔记不存在或无权删除" };
          }

          await db.delete(documents).where(eq(documents.id, args.noteId));
          return { success: true, id: args.noteId };
        } catch (error) {
          console.error("[Tool] deleteNote error:", error);
          return { success: false, error: "删除笔记失败" };
        }
      },
    }),
  };
}
