/**
 * Authentication Utilities
 *
 * 2026 架构师标准：统一的身份验证工具
 *
 * 提供类型安全的 auth 检查函数，消除代码重复
 *
 * 架构原则：
 * - 所有认证类型从 @/auth 统一导入
 * - 不污染全局类型空间
 * - 使用类型断言保证运行时安全
 */

import { type AuthSession, auth } from "@/auth";

// 重新导出 AuthSession，方便其他模块使用
export type { AuthSession };

// ============================================
// Error Types
// ============================================

export class AuthError extends Error {
  readonly code = "UNAUTHORIZED";

  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthError";
  }
}

// ============================================
// Auth Helpers
// ============================================

/**
 * 获取当前用户 Session，未认证则抛出异常
 *
 * @example
 * ```ts
 * export async function myAction() {
 *   const session = await requireAuth();
 *   // session.user.id 一定存在
 * }
 * ```
 */
export async function requireAuth(): Promise<AuthSession> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthError("Authentication required");
  }
  return session as AuthSession;
}

/**
 * 获取当前用户 ID，未认证则抛出异常
 *
 * @example
 * ```ts
 * export async function myAction() {
 *   const userId = await requireUserId();
 *   // userId 一定是 string
 * }
 * ```
 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthError("Authentication required");
  }
  return session.user.id;
}

/**
 * 可选的 Session，未认证返回 null
 *
 * @example
 * ```ts
 * export async function myAction() {
 *   const session = await optionalAuth();
 *   if (session) {
 *     // 已登录用户的逻辑
 *   } else {
 *     // 游客逻辑
 *   }
 * }
 * ```
 */
export async function optionalAuth(): Promise<AuthSession | null> {
  try {
    const session = await auth();
    // 类型守卫：确保 session.user 存在才返回 AuthSession
    if (!session?.user) {
      return null;
    }
    return session as AuthSession;
  } catch {
    return null;
  }
}

/**
 * 可选的用户 ID，未认证返回 null
 */
export async function optionalUserId(): Promise<string | null> {
  try {
    const session = await auth();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

// ============================================
// Rate Limiting Helpers
// ============================================

/**
 * 带速率限制的 auth 检查
 * 返回 userId 和速率限制结果
 */
export async function requireAuthWithRateLimit(
  rateLimitFn: (userId: string) => Promise<{ allowed: boolean }>,
): Promise<{ userId: string; rateLimitResult: { allowed: boolean } }> {
  const userId = await requireUserId();
  const rateLimitResult = await rateLimitFn(userId);

  if (!rateLimitResult.allowed) {
    throw new Error("Rate limit exceeded");
  }

  return { userId, rateLimitResult };
}

// ============================================
// Resource Ownership Helpers
// ============================================

/**
 * 检查资源所有权通用函数
 *
 * @param userId 当前用户 ID
 * @param resourceOwnerId 资源拥有者 ID
 * @param resourceType 资源类型（用于错误消息）
 * @throws {AuthError} 如果所有权不匹配
 *
 * @example
 * ```ts
 * const doc = await db.query.documents.findFirst(...);
 * checkOwnership(userId, doc.userId, "document");
 * ```
 */
export function checkOwnership(
  userId: string,
  resourceOwnerId: string | null | undefined,
  resourceType = "resource",
): void {
  if (!resourceOwnerId) {
    throw new AuthError(`${resourceType} not found`);
  }
  if (userId !== resourceOwnerId) {
    throw new AuthError(`Access denied to this ${resourceType}`);
  }
}

/**
 * 资源所有权检查类型守卫
 *
 * @returns 如果所有权匹配返回 true，否则 false
 */
export function hasOwnership(userId: string, resourceOwnerId: string | null | undefined): boolean {
  return !!resourceOwnerId && userId === resourceOwnerId;
}

// ============================================
// Database-derived Resource Ownership
// ============================================

/**
 * 文档所有权验证器类型
 */
export interface DocumentOwnershipResult {
  ownsDocument: boolean;
  documentId: string;
  workspaceId: string | null;
}

/**
 * 创建文档所有权检查函数（延迟加载 db 依赖以避免循环引用）
 *
 * 用法：
 * ```ts
 * import { verifyDocumentOwnership } from "@/lib/auth/auth-utils";
 * import { db, documents, workspaces } from "@nexusnote/db";
 *
 * const owns = await verifyDocumentOwnership(db, documentId, userId);
 * if (!owns.ownsDocument) throw new AuthError("Access denied");
 * ```
 */
export async function verifyDocumentOwnership(
  db: any,
  documentId: string,
  userId: string,
): Promise<DocumentOwnershipResult> {
  const { documents, workspaces, eq } = await import("@nexusnote/db");

  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, documentId),
    columns: {
      id: true,
      workspaceId: true,
    },
  });

  if (!doc) {
    return { ownsDocument: false, documentId, workspaceId: null };
  }

  if (!doc.workspaceId) {
    // 无 workspace 的文档（如果有这种设计），视为不属于任何用户
    return { ownsDocument: false, documentId, workspaceId: null };
  }

  // 检查 workspace 的所有权
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, doc.workspaceId),
    columns: {
      id: true,
      ownerId: true,
    },
  });

  const ownsDocument = workspace?.ownerId === userId;
  return {
    ownsDocument,
    documentId,
    workspaceId: doc.workspaceId,
  };
}
