/**
 * Chat Sessions API - CRUD Operations
 *
 * GET: 获取会话列表
 * POST: 创建新会话（不保存消息，返回 pendingMessage 让前端发送）
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { conversations, db, desc, eq, sql } from "@/db";
import { authOptions } from "../auth/[...nextauth]/route";

interface CreateSessionBody {
  title?: string;
  intent?: string;
  firstMessage?: string;
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const list = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        intent: conversations.intent,
        summary: conversations.summary,
        messageCount: conversations.messageCount,
        lastMessageAt: conversations.lastMessageAt,
        isArchived: conversations.isArchived,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .where(userId ? eq(conversations.userId, userId) : sql`1=1`)
      .orderBy(desc(conversations.lastMessageAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ sessions: list });
  } catch (error) {
    console.error("[ChatSessions] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;

    const body: CreateSessionBody = await request.json();
    const { title = "新对话", intent = "CHAT", firstMessage } = body;

    const now = new Date();

    // 不保存消息到数据库，让 useChat 成为唯一消息源
    // 返回 pendingMessage 让前端自动发送
    const [newSession] = await db
      .insert(conversations)
      .values({
        userId,
        title: firstMessage
          ? firstMessage.slice(0, 30) + (firstMessage.length > 30 ? "..." : "")
          : title,
        intent,
        messages: [],
        messageCount: 0,
        lastMessageAt: now,
      })
      .returning();

    return NextResponse.json({
      session: newSession,
      pendingMessage: firstMessage || null,
    });
  } catch (error) {
    console.error("[ChatSessions] POST error:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
