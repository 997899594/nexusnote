/**
 * Comments - 文档评论功能
 */

"use client";

import { createContext, useContext, useState } from "react";

export interface Comment {
  id: string;
  content: string;
  author: { id: string; name: string; avatar?: string };
  position: { from: number; to: number; text: string };
  resolved: boolean;
  replies: CommentReply[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentReply {
  id: string;
  content: string;
  author: { id: string; name: string; avatar?: string };
  createdAt: Date;
}

interface CommentsContextValue {
  comments: Comment[];
  activeComment: Comment | null;
  addComment: (
    comment: Omit<Comment, "id" | "resolved" | "replies" | "createdAt" | "updatedAt">,
  ) => void;
  resolveComment: (id: string) => void;
  reopenComment: (id: string) => void;
  addReply: (commentId: string, reply: Omit<CommentReply, "id" | "createdAt">) => void;
  deleteComment: (id: string) => void;
  setActiveComment: (comment: Comment | null) => void;
}

const CommentsContext = createContext<CommentsContextValue | null>(null);

export function useComments() {
  const context = useContext(CommentsContext);
  if (!context) throw new Error("useComments must be used within CommentsProvider");
  return context;
}

export function CommentsProvider({ children }: { children: React.ReactNode }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [activeComment, setActiveComment] = useState<Comment | null>(null);

  const addComment = (
    comment: Omit<Comment, "id" | "resolved" | "replies" | "createdAt" | "updatedAt">,
  ) => {
    const newComment: Comment = {
      ...comment,
      id: crypto.randomUUID(),
      resolved: false,
      replies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setComments((prev) => [...prev, newComment]);
  };

  const resolveComment = (id: string) => {
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, resolved: true, updatedAt: new Date() } : c)),
    );
  };

  const reopenComment = (id: string) => {
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, resolved: false, updatedAt: new Date() } : c)),
    );
  };

  const addReply = (commentId: string, reply: Omit<CommentReply, "id" | "createdAt">) => {
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) {
          return {
            ...c,
            replies: [...c.replies, { ...reply, id: crypto.randomUUID(), createdAt: new Date() }],
            updatedAt: new Date(),
          };
        }
        return c;
      }),
    );
  };

  const deleteComment = (id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id));
    if (activeComment?.id === id) setActiveComment(null);
  };

  return (
    <CommentsContext.Provider
      value={{
        comments,
        activeComment,
        addComment,
        resolveComment,
        reopenComment,
        addReply,
        deleteComment,
        setActiveComment,
      }}
    >
      {children}
    </CommentsContext.Provider>
  );
}

export function CommentThread({ comment }: { comment: Comment; onSelect?: () => void }) {
  const { resolveComment, reopenComment, addReply, deleteComment } = useComments();
  const [replyText, setReplyText] = useState("");
  const [showReply, setShowReply] = useState(false);

  const handleReply = () => {
    if (!replyText.trim()) return;
    addReply(comment.id, { content: replyText, author: { id: "current", name: "我" } });
    setReplyText("");
    setShowReply(false);
  };

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        margin: "8px 0",
        background: comment.resolved ? "#f9f9f9" : "white",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: 12,
          borderBottom: comment.replies.length > 0 ? "1px solid #eee" : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "#0070f3",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
            }}
          >
            {comment.author.name[0]}
          </div>
          <span style={{ fontWeight: 500, fontSize: 14 }}>{comment.author.name}</span>
          <span style={{ color: "#999", fontSize: 12 }}>{comment.createdAt.toLocaleString()}</span>
          {comment.resolved && <span style={{ color: "#22c55e", fontSize: 12 }}>已解决</span>}
        </div>
        <div style={{ fontSize: 14, marginBottom: 8 }}>
          <span
            style={{ background: "#fef3c7", padding: "2px 4px", borderRadius: 4, marginRight: 8 }}
          >
            "{comment.position.text.slice(0, 30)}..."
          </span>
        </div>
        <div style={{ fontSize: 14 }}>{comment.content}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            type="button"
            onClick={() => setShowReply(!showReply)}
            style={{
              background: "none",
              border: "none",
              color: "#0070f3",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            回复
          </button>
          {comment.resolved ? (
            <button
              onClick={() => reopenComment(comment.id)}
              style={{
                background: "none",
                border: "none",
                color: "#666",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              重新打开
            </button>
          ) : (
            <button
              type="button"
              onClick={() => resolveComment(comment.id)}
              style={{
                background: "none",
                border: "none",
                color: "#22c55e",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              解决
            </button>
          )}
          <button
            type="button"
            onClick={() => deleteComment(comment.id)}
            style={{
              background: "none",
              border: "none",
              color: "#ef4444",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            删除
          </button>
        </div>
      </div>
      {comment.replies.map((reply) => (
        <div
          key={reply.id}
          style={{
            padding: "8px 12px",
            background: "#f9f9f9",
            borderTop: "1px solid #eee",
            display: "flex",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#666",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
            }}
          >
            {reply.author.name[0]}
          </div>
          <div>
            <div style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 500 }}>{reply.author.name}</span>
              <span style={{ color: "#999", marginLeft: 8, fontSize: 12 }}>
                {reply.createdAt.toLocaleString()}
              </span>
            </div>
            <div style={{ fontSize: 13 }}>{reply.content}</div>
          </div>
        </div>
      ))}
      {showReply && (
        <div style={{ padding: 8, borderTop: "1px solid #eee", display: "flex", gap: 8 }}>
          <input
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="写回复..."
            style={{
              flex: 1,
              padding: "8px 12px",
              border: "1px solid #ddd",
              borderRadius: 6,
              fontSize: 13,
            }}
          />
          <button
            type="button"
            onClick={handleReply}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: 6,
              background: "#0070f3",
              color: "white",
              cursor: "pointer",
            }}
          >
            发送
          </button>
        </div>
      )}
    </div>
  );
}

export function CommentsPanel() {
  const { comments, setActiveComment } = useComments();
  const unresolved = comments.filter((c) => !c.resolved);

  return (
    <div
      style={{
        width: 300,
        borderLeft: "1px solid #ddd",
        padding: 16,
        height: "100%",
        overflowY: "auto",
        background: "#fafafa",
      }}
    >
      <h3 style={{ margin: "0 0 16px 0", fontSize: 16 }}>评论 ({unresolved.length})</h3>
      {comments.length === 0 ? (
        <p style={{ color: "#999", fontSize: 14 }}>暂无评论</p>
      ) : (
        comments.map((comment) => (
          <CommentThread
            key={comment.id}
            comment={comment}
            onSelect={() => setActiveComment(comment)}
          />
        ))
      )}
    </div>
  );
}
