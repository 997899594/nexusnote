"use client";

import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function CollapsibleComponent({ node, updateAttributes }: NodeViewProps) {
  const { open, title } = node.attrs;
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const toggleOpen = () => {
    updateAttributes({ open: !open });
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditTitle(title);
  };

  const handleTitleBlur = () => {
    setIsEditing(false);
    if (editTitle.trim() && editTitle !== title) {
      updateAttributes({ title: editTitle.trim() });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTitleBlur();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditTitle(title);
    }
  };

  return (
    <NodeViewWrapper className="collapsible border rounded-lg my-2 overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2 bg-muted/50 cursor-pointer hover:bg-muted/70 transition select-none"
        onClick={toggleOpen}
        contentEditable={false}
      >
        <span className="text-muted-foreground flex-shrink-0">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-transparent border-none outline-none text-sm font-medium"
          />
        ) : (
          <span className="flex-1 text-sm font-medium" onClick={handleTitleClick}>
            {title}
          </span>
        )}
      </div>
      {open && (
        <div className="px-4 py-3 border-t">
          <NodeViewContent className="prose prose-sm min-h-[1.5em]" />
        </div>
      )}
    </NodeViewWrapper>
  );
}

export default CollapsibleComponent;
