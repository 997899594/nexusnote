"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Cpu, Loader2, Sparkles, X } from "lucide-react";

export type GenerationStep = {
  id: string;
  text: string;
  status: "pending" | "processing" | "completed" | "error";
};

interface GenerationProgressProps {
  steps: GenerationStep[];
  currentGoal: string;
}

export function GenerationProgress({ steps, currentGoal }: GenerationProgressProps) {
  const completedSteps = steps.filter((s) => s.status === "completed").length;
  const progressPercent = steps.length > 0 ? (completedSteps / steps.length) * 100 : 0;

  return (
    <div className="w-full max-w-2xl mx-auto px-6 py-12">
      <div className="flex flex-col items-center mb-16">
        {/* Immersive Icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 rounded-[40px] bg-black text-white flex items-center justify-center shadow-2xl shadow-black/20 mb-10 relative"
        >
          <AnimatePresence mode="wait">
            {progressPercent < 100 ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, rotate: -180 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 180 }}
              >
                <Cpu className="w-10 h-10 animate-pulse text-white/80" />
              </motion.div>
            ) : (
              <motion.div
                key="ready"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Check className="w-10 h-10" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pulse rings */}
          {progressPercent < 100 && (
            <>
              <motion.div
                animate={{ scale: [1, 1.6], opacity: [0.3, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-[40px] border border-black"
              />
              <motion.div
                animate={{ scale: [1, 2], opacity: [0.2, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                className="absolute inset-0 rounded-[40px] border border-black"
              />
            </>
          )}
        </motion.div>

        <div className="text-center">
          <p className="text-[10px] font-bold text-black/20 uppercase tracking-[0.3em] mb-3">
            {progressPercent < 100 ? "Architecting Knowledge" : "Generation Complete"}
          </p>
          <h2 className="text-3xl font-bold text-black tracking-tight max-w-lg mx-auto leading-tight">
            {currentGoal}
          </h2>
        </div>
      </div>

      {/* Progress Steps List */}
      <div className="space-y-4 mb-12">
        <AnimatePresence mode="popLayout">
          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`flex items-center gap-4 p-5 rounded-[24px] border transition-all ${
                step.status === "processing"
                  ? "bg-white shadow-xl shadow-black/5 border-black/5"
                  : "bg-black/[0.01] border-transparent"
              }`}
            >
              <div className="shrink-0">
                {step.status === "processing" && (
                  <div className="w-6 h-6 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-black" />
                  </div>
                )}
                {step.status === "completed" && (
                  <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
                {step.status === "error" && (
                  <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                    <X className="w-3 h-3 text-white" />
                  </div>
                )}
                {step.status === "pending" && (
                  <div className="w-6 h-6 rounded-full border-2 border-black/5" />
                )}
              </div>

              <div
                className={`text-sm font-bold tracking-tight flex-1 ${
                  step.status === "completed"
                    ? "text-black/30"
                    : step.status === "error"
                      ? "text-red-600"
                      : step.status === "processing"
                        ? "text-black"
                        : "text-black/10"
                }`}
              >
                {step.text}
              </div>

              {step.status === "processing" && (
                <Sparkles className="w-4 h-4 text-black/20 animate-pulse" />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom Global Progress */}
      <div className="relative h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
        <motion.div
          className="absolute top-0 left-0 h-full bg-black"
          initial={{ width: "0%" }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}
