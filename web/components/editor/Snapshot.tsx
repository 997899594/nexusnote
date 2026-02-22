/**
 * Snapshot - 版本历史功能
 */

"use client";

import { createContext, useContext, useState } from "react";

export interface Snapshot {
  id: string;
  name: string;
  content: string;
  html: string;
  createdAt: Date;
  auto: boolean;
}

interface SnapshotContextValue {
  snapshots: Snapshot[];
  currentSnapshot: Snapshot | null;
  createSnapshot: (name?: string, content?: string, html?: string) => void;
  restoreSnapshot: (id: string) => void;
  deleteSnapshot: (id: string) => void;
  setCurrentSnapshot: (snapshot: Snapshot | null) => void;
  getSnapshot: (id: string) => Snapshot | undefined;
}

const SnapshotContext = createContext<SnapshotContextValue | null>(null);

export function useSnapshots() {
  const context = useContext(SnapshotContext);
  if (!context) throw new Error("useSnapshots must be used within SnapshotProvider");
  return context;
}

export function SnapshotProvider({
  children,
  getCurrentContent,
}: {
  children: React.ReactNode;
  getCurrentContent: () => { content: string; html: string };
}) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [currentSnapshot, setCurrentSnapshot] = useState<Snapshot | null>(null);

  const createSnapshot = (name?: string, content?: string, html?: string) => {
    const current = content && html ? { content, html } : getCurrentContent();
    const newSnapshot: Snapshot = {
      id: crypto.randomUUID(),
      name: name || `版本 ${snapshots.length + 1}`,
      content: current.content,
      html: current.html,
      createdAt: new Date(),
      auto: !name,
    };
    setSnapshots((prev) => [newSnapshot, ...prev]);
    setCurrentSnapshot(newSnapshot);
  };

  const restoreSnapshot = (id: string) => {
    const snapshot = snapshots.find((s) => s.id === id);
    if (snapshot) setCurrentSnapshot(snapshot);
  };

  const deleteSnapshot = (id: string) => {
    setSnapshots((prev) => prev.filter((s) => s.id !== id));
    if (currentSnapshot?.id === id) setCurrentSnapshot(null);
  };

  const getSnapshot = (id: string) => snapshots.find((s) => s.id === id);

  return (
    <SnapshotContext.Provider
      value={{
        snapshots,
        currentSnapshot,
        createSnapshot,
        restoreSnapshot,
        deleteSnapshot,
        setCurrentSnapshot,
        getSnapshot,
      }}
    >
      {children}
    </SnapshotContext.Provider>
  );
}

export function SnapshotItem({
  snapshot,
  onRestore,
  onDelete,
  isActive,
}: {
  snapshot: Snapshot;
  onRestore: () => void;
  onDelete: () => void;
  isActive: boolean;
}) {
  return (
    <button
      type="button"
      className={`w-full py-3 border-b border-border text-left cursor-pointer border-none bg-transparent ${
        isActive ? "bg-sky-50" : "bg-surface"
      }`}
      onClick={onRestore}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{snapshot.name}</span>
        {snapshot.auto && (
          <span className="text-[10px] px-1.5 py-0.5 bg-yellow-100 rounded">自动</span>
        )}
      </div>
      <div className="text-xs text-text-secondary mb-2">{snapshot.createdAt.toLocaleString()}</div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-tertiary">{snapshot.content.length} 字符</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="bg-transparent border-none text-red-500 cursor-pointer text-xs hover:underline"
        >
          删除
        </button>
      </div>
    </button>
  );
}

export function SnapshotPanel({ onRestore }: { onRestore: (content: string) => void }) {
  const { snapshots, currentSnapshot, createSnapshot, restoreSnapshot, deleteSnapshot } =
    useSnapshots();

  return (
    <div className="w-[280px] border-l border-border p-4 h-full overflow-y-auto bg-muted/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="m-0 text-base font-medium">版本历史</h3>
        <button
          type="button"
          onClick={() => createSnapshot()}
          className="px-3 py-1.5 text-xs bg-white border border-border rounded-md cursor-pointer hover:bg-hover"
        >
          创建快照
        </button>
      </div>
      {snapshots.length === 0 ? (
        <p className="text-text-tertiary text-sm">暂无版本历史</p>
      ) : (
        snapshots.map((snapshot) => (
          <SnapshotItem
            key={snapshot.id}
            snapshot={snapshot}
            isActive={currentSnapshot?.id === snapshot.id}
            onRestore={() => {
              restoreSnapshot(snapshot.id);
              onRestore(snapshot.content);
            }}
            onDelete={() => deleteSnapshot(snapshot.id)}
          />
        ))
      )}
    </div>
  );
}
