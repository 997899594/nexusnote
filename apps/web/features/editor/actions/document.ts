"use server";

/**
 * 2026 架构师标准：Document Server Actions
 *
 * 职责：
 * 1. 替代 /api/documents/* 路由
 * 2. 提供类型安全的文档数据获取
 */

import { db, documents, eq } from "@nexusnote/db";
import { createSafeAction } from "@/lib/actions/action-utils";
import { AuthError, verifyDocumentOwnership } from "@/lib/auth/auth-utils";

/**
 * 获取单个文档
 */
export const getDocumentAction = createSafeAction(
  "getDocument",
  async (documentId: string, userId) => {
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!doc) {
      throw new Error("Document not found");
    }

    // 验证文档所有权（通过 workspace）
    const ownership = await verifyDocumentOwnership(db, documentId, userId);
    if (!ownership.ownsDocument) {
      throw new AuthError("Access denied to this document");
    }

    return {
      id: doc.id,
      title: doc.title,
      content: doc.content ? doc.content.toString("base64") : null, // Buffer 转为 base64 传输
      updatedAt: doc.updatedAt,
      isVault: doc.isVault,
    };
  },
);

/**
 * 更新文档属性
 */
export const updateDocumentAction = createSafeAction(
  "updateDocument",
  async (payload: { documentId: string; isVault?: boolean; title?: string }, userId) => {
    const { documentId, ...updates } = payload;

    // 验证文档所有权（通过 workspace）
    const ownership = await verifyDocumentOwnership(db, documentId, userId);
    if (!ownership.ownsDocument) {
      throw new AuthError("Access denied to this document");
    }

    const [updatedDoc] = await db
      .update(documents)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId))
      .returning();

    if (!updatedDoc) {
      throw new Error("Document not found");
    }

    return { success: true };
  },
);
