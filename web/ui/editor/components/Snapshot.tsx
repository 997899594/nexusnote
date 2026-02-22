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
      style={{
        width: "100%",
        padding: 12,
        borderBottom: "1px solid #eee",
        background: isActive ? "#f0f9ff" : "white",
        cursor: "pointer",
        border: "none",
        textAlign: "left",
      }}
      onClick={onRestore}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4,
        }}
      >
        <span style={{ fontWeight: 500, fontSize: 14 }}>{snapshot.name}</span>
        {snapshot.auto && (
          <span
            style={{ fontSize: 10, padding: "2px 6px", background: "#fef3c7", borderRadius: 4 }}
          >
            自动
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
        {snapshot.createdAt.toLocaleString()}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#999" }}>{snapshot.content.length} 字符</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{
            background: "none",
            border: "none",
            color: "#ef4444",
            cursor: "pointer",
            fontSize: 12,
          }}
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
    <div
      style={{
        width: 280,
        borderLeft: "1px solid #ddd",
        padding: 16,
        height: "100%",
        overflowY: "auto",
        background: "#fafafa",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16 }}>版本历史</h3>
        <button
          onClick={() => createSnapshot()}
          style={{
            padding: "6px 12px",
            border: "1px solid #ddd",
            borderRadius: 6,
            background: "white",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          创建快照
        </button>
      </div>
      {snapshots.length === 0 ? (
        <p style={{ color: "#999", fontSize: 14 }}>暂无版本历史</p>
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
