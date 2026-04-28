/**
 * Toast - Toast Notifications with Framer Motion
 *
 * 使用 framer-motion 实现高级动画
 */

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles = {
  success:
    "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] [&_svg]:text-emerald-600",
  error:
    "border-[color-mix(in_oklch,var(--color-panel-strong)_18%,var(--color-border))] bg-[var(--color-surface)] text-[var(--color-text)] [&_svg]:text-[var(--color-panel-strong)]",
  warning:
    "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] [&_svg]:text-[var(--color-text-secondary)]",
  info: "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] [&_svg]:text-[var(--color-text-secondary)]",
};

const toastVariants = {
  hidden: { opacity: 0, x: 50, scale: 0.9 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: "spring" as const, bounce: 0.3, duration: 0.5 },
  },
  exit: {
    opacity: 0,
    x: 50,
    scale: 0.9,
    transition: { duration: 0.2 },
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const addToast = (message: string, type: ToastType = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {mounted && (
        <div className="safe-bottom fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2 md:inset-x-auto md:right-6 md:bottom-6">
          <AnimatePresence mode="popLayout">
            {toasts.map((toast) => {
              const Icon = icons[toast.type];
              return (
                <motion.div
                  key={toast.id}
                  variants={toastVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  layout
                  className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 shadow-xl md:min-w-[300px] md:max-w-md ${styles[toast.type]}`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <p className="flex-1 text-sm font-medium">{toast.message}</p>
                  <motion.button
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => removeToast(toast.id)}
                    className="flex-shrink-0 text-[var(--color-text-muted)] opacity-70 hover:text-[var(--color-text)] hover:opacity-100"
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </ToastContext.Provider>
  );
}
