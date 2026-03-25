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
      className={`mx-2 my-2 overflow-hidden rounded-2xl shadow-[0_20px_46px_-36px_rgba(15,23,42,0.18)] ${
        comment.resolved ? "bg-[#f6f7f9]" : "bg-white"
      }`}
    >
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#111827] text-xs text-white">
            {comment.author.name[0]}
          </div>
          <span className="text-sm font-medium">{comment.author.name}</span>
          <span className="text-xs text-text-tertiary">{comment.createdAt.toLocaleString()}</span>
          {comment.resolved && <span className="text-xs text-zinc-600">已解决</span>}
        </div>
        <div className="text-sm mb-2">
          <span className="mr-2 rounded-md bg-[#f3f5f8] px-1.5 py-0.5 text-[var(--color-text-secondary)]">
            "{comment.position.text.slice(0, 30)}..."
          </span>
        </div>
        <div className="text-sm">{comment.content}</div>
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => setShowReply(!showReply)}
            className="cursor-pointer border-none bg-transparent text-sm text-[#111827] hover:underline"
          >
            回复
          </button>
          {comment.resolved ? (
            <button
              type="button"
              onClick={() => reopenComment(comment.id)}
              className="cursor-pointer border-none bg-transparent text-sm text-[var(--color-text-secondary)] hover:underline"
            >
              重新打开
            </button>
          ) : (
            <button
              type="button"
              onClick={() => resolveComment(comment.id)}
              className="cursor-pointer border-none bg-transparent text-sm text-[var(--color-text-secondary)] hover:underline"
            >
              解决
            </button>
          )}
          <button
            type="button"
            onClick={() => deleteComment(comment.id)}
            className="bg-transparent border-none text-red-500 cursor-pointer text-sm hover:underline"
          >
            删除
          </button>
        </div>
      </div>
      {comment.replies.map((reply) => (
        <div key={reply.id} className="flex gap-2 bg-[#f6f7f9] p-2 px-3">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-500 text-[10px] text-white">
            {reply.author.name[0]}
          </div>
          <div>
            <div className="text-sm">
              <span className="font-medium">{reply.author.name}</span>
              <span className="text-text-tertiary ml-2 text-xs">
                {reply.createdAt.toLocaleString()}
              </span>
            </div>
            <div className="text-sm">{reply.content}</div>
          </div>
        </div>
      ))}
      {showReply && (
        <div className="flex gap-2 bg-[#f6f7f9] p-2">
          <input
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="写回复..."
            className="flex-1 rounded-xl border border-transparent bg-white px-3 py-2 text-sm shadow-[0_12px_28px_-24px_rgba(15,23,42,0.14)] outline-none"
          />
          <button
            type="button"
            onClick={handleReply}
            className="cursor-pointer rounded-xl bg-[#111827] px-4 py-2 text-sm text-white"
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
    <div className="h-full w-[300px] overflow-y-auto bg-[#f6f7f9] p-4">
      <h3 className="m-0 mb-4 text-base font-medium">评论 ({unresolved.length})</h3>
      {comments.length === 0 ? (
        <p className="text-text-tertiary text-sm">暂无评论</p>
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
