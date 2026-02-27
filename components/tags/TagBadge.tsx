"use client";
import { X } from "lucide-react";
import { useState } from "react";

interface TagBadgeProps {
  name: string;
  onRemove?: () => void;
  removable?: boolean;
}

export function TagBadge({ name, onRemove, removable = false }: TagBadgeProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const handleRemove = async () => {
    if (!onRemove) return;
    setIsRemoving(true);
    try { await onRemove(); } finally { setIsRemoving(false); }
  };
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-sm bg-secondary text-secondary-foreground rounded-md">
      {name}
      {removable && (
        <button onClick={handleRemove} disabled={isRemoving} className="ml-1 hover:bg-secondary-foreground/20 rounded-sm p-0.5 transition-colors" aria-label="移除标签">
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}
