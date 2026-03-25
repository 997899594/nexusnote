"use client";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";

interface PendingTag {
  id: string;
  confidence: number;
  tag: { id: string; name: string };
}
interface PendingTagsPopoverProps {
  pending: PendingTag[];
  onConfirm: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}

export function PendingTagsPopover({ pending, onConfirm, onReject }: PendingTagsPopoverProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  if (pending.length === 0) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className="cursor-pointer border-none bg-white shadow-[0_12px_28px_-24px_rgba(15,23,42,0.14)] transition-colors hover:bg-[#f6f7f9]"
        >
          + {pending.length} 建议待确认
        </Badge>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 rounded-2xl border-none bg-white shadow-[0_24px_56px_-36px_rgba(15,23,42,0.18)]"
        align="start"
      >
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground mb-3">AI 建议的标签</p>
          {pending.map((dt) => (
            <div key={dt.id} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="text-sm">{dt.tag.name}</span>
                <span className="text-xs text-muted-foreground">
                  {Math.round(dt.confidence * 100)}%
                </span>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-[#111827] hover:bg-[#f3f5f8] hover:text-[#111827]"
                  onClick={() => {
                    setLoadingId(dt.id);
                    onConfirm(dt.id).finally(() => setLoadingId(null));
                  }}
                  disabled={loadingId === dt.id}
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-zinc-500 hover:bg-[#f3f5f8] hover:text-zinc-700"
                  onClick={() => {
                    setLoadingId(dt.id);
                    onReject(dt.id).finally(() => setLoadingId(null));
                  }}
                  disabled={loadingId === dt.id}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
