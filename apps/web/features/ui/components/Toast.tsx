/**
 * Toast - Toast Notifications with Framer Motion
 *
 * 使用 framer-motion 实现高级动画
 */

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import { createContext, type ReactNode, useContext, useState } from "react";

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
  success: "bg-emerald-500 text-white border-emerald-600",
  error: "bg-rose-500 text-white border-rose-600",
  warning: "bg-amber-500 text-white border-amber-600",
  info: "bg-sky-500 text-white border-sky-600",
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
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
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
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border min-w-[300px] max-w-md ${styles[toast.type]}`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <p className="flex-1 text-sm font-medium">{toast.message}</p>
                <motion.button
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => removeToast(toast.id)}
                  className="flex-shrink-0 opacity-60 hover:opacity-100"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
