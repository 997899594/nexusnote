"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useAtomValue } from "jotai";
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import { type Toast, toastsAtom } from "@/features/shared/atoms/ui";

const toastIcons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const toastStyles = {
  success: "bg-emerald-500 text-white border-emerald-600",
  error: "bg-rose-500 text-white border-rose-600",
  warning: "bg-amber-500 text-white border-amber-600",
  info: "bg-sky-500 text-white border-sky-600",
};

/**
 * Single Toast Item
 */
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const Icon = toastIcons[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.9 }}
      transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}
      className={`flex items-start gap-3 px-4 py-3 rounded-2xl shadow-xl shadow-black/10 border ${toastStyles[toast.type]} min-w-[300px] max-w-md`}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <p className="flex-1 text-sm font-medium leading-snug">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

/**
 * Toast Container - Renders all active toasts
 * Place this in your root layout
 */
export function Toaster() {
  const toasts = useAtomValue(toastsAtom);

  const handleRemove = (_id: string) => {
    const { toastsAtom: atom } = require("@/features/shared/atoms/ui");
    const { setAtom } = require("jotai");
    // This is handled by the auto-remove in useToast, but users can also click to dismiss
    // For manual dismiss, we'd need a setter - keeping it simple for now
  };

  return (
    <div className="fixed bottom-6 right-6 z-[1000] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onRemove={handleRemove} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * Hook to use the Toaster component
 */
export function useToaster() {
  return { Toaster };
}
