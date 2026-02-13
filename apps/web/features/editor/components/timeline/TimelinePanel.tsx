"use client";

import {
  ChevronDown,
  Clock,
  GitCompare,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type * as Y from "yjs";
import { type DocumentSnapshot, type SnapshotTrigger, snapshotStore } from "@/lib/storage";
import { DiffView } from "./DiffView";

interface TimelinePanelProps {
  documentId: string;
  ydoc: Y.Doc | null;
  isOpen: boolean;
  onClose: () => void;
  onRestore: (snapshot: DocumentSnapshot) => void;
}

const triggerConfig: Record<
  SnapshotTrigger,
  { icon: React.ReactNode; label: string; color: string }
> = {
  auto: { icon: <Clock className="w-3.5 h-3.5" />, label: "自动", color: "text-zinc-400" },
  manual: { icon: <Save className="w-3.5 h-3.5" />, label: "手动保存", color: "text-emerald-500" },
  ai_edit: {
    icon: <Sparkles className="w-3.5 h-3.5" />,
    label: "AI 编辑",
    color: "text-violet-500",
  },
  collab_join: { icon: <Users className="w-3.5 h-3.5" />, label: "协作者", color: "text-blue-500" },
  restore: { icon: <RotateCcw className="w-3.5 h-3.5" />, label: "恢复", color: "text-amber-500" },
};

export function TimelinePanel({
  documentId,
  ydoc,
  isOpen,
  onClose,
  onRestore,
}: TimelinePanelProps) {
  const [snapshots, setSnapshots] = useState<DocumentSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<DocumentSnapshot | null>(null);
  const [compareSnapshot, setCompareSnapshot] = useState<DocumentSnapshot | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    try {
      const snaps = await snapshotStore.getSnapshots(documentId);
      setSnapshots(snaps);
      // Auto-expand today
      if (snaps.length > 0) {
        const date = new Date();
        const todayStr =
          date.toDateString() === new Date().toDateString()
            ? "今天"
            : date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
        setExpandedDates(new Set([todayStr]));
      }
    } catch (error) {
      console.error("Failed to load snapshots:", error);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (isOpen && documentId) {
      loadSnapshots();
    }
  }, [isOpen, documentId, loadSnapshots]);

  const handleCreateManualSnapshot = async () => {
    if (!ydoc) return;
    await snapshotStore.createSnapshot(documentId, ydoc, "manual");
    await loadSnapshots();
  };

  const handleRestore = async (snapshot: DocumentSnapshot) => {
    if (confirm("恢复到此版本？当前内容会自动备份。")) {
      onRestore(snapshot);
      await loadSnapshots();
    }
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return new Date(timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "今天";
    if (date.toDateString() === yesterday.toDateString()) return "昨天";
    return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  };

  const groupSnapshotsByDate = (snapshots: DocumentSnapshot[]) => {
    const groups: Map<string, DocumentSnapshot[]> = new Map();
    for (const snap of snapshots) {
      const date = formatDate(snap.timestamp);
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date)!.push(snap);
    }
    return groups;
  };

  const toggleDate = (date: string) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDates(newExpanded);
  };

  if (!isOpen) return null;

  const groups = groupSnapshotsByDate(snapshots);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-72 bg-zinc-900 border-l border-zinc-800 shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800">
          <span className="text-sm font-medium text-zinc-200">版本历史</span>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Save Button */}
        <div className="px-3 py-2 border-b border-zinc-800/50">
          <button
            onClick={handleCreateManualSnapshot}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            保存当前版本
          </button>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-24">
              <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
            </div>
          ) : snapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-zinc-500 text-sm">
              <Clock className="w-6 h-6 mb-2 opacity-40" />
              <p>暂无历史版本</p>
            </div>
          ) : (
            <div className="py-1">
              {Array.from(groups.entries()).map(([date, dateSnapshots]) => (
                <div key={date}>
                  {/* Date Header */}
                  <button
                    onClick={() => toggleDate(date)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-400 hover:bg-zinc-800/50"
                  >
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${expandedDates.has(date) ? "" : "-rotate-90"}`}
                    />
                    {date}
                    <span className="text-zinc-600">({dateSnapshots.length})</span>
                  </button>

                  {/* Snapshots */}
                  {expandedDates.has(date) && (
                    <div className="relative ml-3 pl-3 border-l border-zinc-800">
                      {dateSnapshots.map((snapshot, idx) => {
                        const config = triggerConfig[snapshot.trigger];
                        const isFirst = idx === 0 && date === "今天";

                        return (
                          <div
                            key={snapshot.id}
                            className={`group relative py-2 px-2 mx-1 rounded hover:bg-zinc-800/50 cursor-pointer ${
                              selectedSnapshot?.id === snapshot.id ? "bg-zinc-800" : ""
                            }`}
                          >
                            {/* Dot */}
                            <div
                              className={`absolute -left-[17px] top-3 w-2 h-2 rounded-full border-2 ${
                                isFirst
                                  ? "bg-emerald-500 border-emerald-500"
                                  : "bg-zinc-900 border-zinc-600"
                              }`}
                            />

                            {/* Content */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className={config.color}>{config.icon}</span>
                                  <span className="text-xs text-zinc-300">{config.label}</span>
                                  <span className="text-xs text-zinc-600">
                                    {formatTime(snapshot.timestamp)}
                                  </span>
                                </div>

                                {snapshot.summary && (
                                  <p className="mt-0.5 text-xs text-zinc-500 truncate">
                                    {snapshot.summary}
                                  </p>
                                )}

                                <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-600">
                                  <span>{snapshot.wordCount}字</span>
                                  {snapshot.diffFromPrevious && (
                                    <>
                                      {snapshot.diffFromPrevious.added > 0 && (
                                        <span className="text-emerald-600">
                                          +{snapshot.diffFromPrevious.added}
                                        </span>
                                      )}
                                      {snapshot.diffFromPrevious.removed > 0 && (
                                        <span className="text-red-500">
                                          -{snapshot.diffFromPrevious.removed}
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Hover Actions */}
                            <div className="absolute right-1 top-1.5 hidden group-hover:flex items-center gap-0.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedSnapshot(snapshot);
                                  setShowDiff(true);
                                }}
                                className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 rounded"
                                title="对比当前"
                              >
                                <GitCompare className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRestore(snapshot);
                                }}
                                className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 rounded"
                                title="恢复此版本"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-zinc-800 text-[10px] text-zinc-600">
          共 {snapshots.length} 个版本 · 自动保存每5分钟
        </div>
      </div>

      {/* Diff View */}
      {showDiff && selectedSnapshot && (
        <DiffView
          snapshot1={selectedSnapshot}
          snapshot2={compareSnapshot}
          currentYDoc={ydoc}
          onClose={() => {
            setShowDiff(false);
            setSelectedSnapshot(null);
            setCompareSnapshot(null);
          }}
        />
      )}
    </>
  );
}
