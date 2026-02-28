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
        <Badge variant="outline" className="cursor-pointer hover:bg-secondary transition-colors">
          + {pending.length} 建议待确认
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
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
                  className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
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
                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
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
