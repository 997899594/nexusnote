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
      className={`border border-border rounded-lg mx-2 my-2 overflow-hidden ${
        comment.resolved ? "bg-muted" : "bg-surface"
      }`}
    >
      <div className={`p-3 ${comment.replies.length > 0 ? "border-b border-border" : ""}`}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-accent text-accent-fg flex items-center justify-center text-xs">
            {comment.author.name[0]}
          </div>
          <span className="text-sm font-medium">{comment.author.name}</span>
          <span className="text-xs text-text-tertiary">{comment.createdAt.toLocaleString()}</span>
          {comment.resolved && <span className="text-xs text-green-600">已解决</span>}
        </div>
        <div className="text-sm mb-2">
          <span className="bg-yellow-100 px-1 py-0.5 rounded mr-2">
            "{comment.position.text.slice(0, 30)}..."
          </span>
        </div>
        <div className="text-sm">{comment.content}</div>
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => setShowReply(!showReply)}
            className="bg-transparent border-none text-accent cursor-pointer text-sm hover:underline"
          >
            回复
          </button>
          {comment.resolved ? (
            <button
              type="button"
              onClick={() => reopenComment(comment.id)}
              className="bg-transparent border-none text-text-secondary cursor-pointer text-sm hover:underline"
            >
              重新打开
            </button>
          ) : (
            <button
              type="button"
              onClick={() => resolveComment(comment.id)}
              className="bg-transparent border-none text-green-600 cursor-pointer text-sm hover:underline"
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
        <div key={reply.id} className="p-2 px-3 bg-muted border-t border-border flex gap-2">
          <div className="w-5 h-5 rounded-full bg-text-secondary text-white flex items-center justify-center text-[10px]">
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
        <div className="p-2 border-t border-border flex gap-2">
          <input
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="写回复..."
            className="flex-1 px-3 py-2 text-sm border border-border rounded-md"
          />
          <button
            type="button"
            onClick={handleReply}
            className="px-4 py-2 text-sm text-white bg-accent rounded-md cursor-pointer hover:bg-accent-hover"
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
    <div className="w-[300px] border-l border-border p-4 h-full overflow-y-auto bg-muted/50">
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
