/**
 * OptionCards - AI 选项展示组件
 *
 * 用于 presentOptions 工具，支持多种样式
 */
"use client";

import { motion } from "framer-motion";
import { BookOpen, Check, ChevronRight, Heart, Sparkles, Target, Zap } from "lucide-react";

export type OptionStyle = "card" | "button" | "chip" | "icon";

export interface OptionCardsProps {
  question?: string;
  options: string[];
  onSelect: (option: string) => void;
  style?: OptionStyle;
  targetField?: string;
  multiSelect?: boolean;
  compact?: boolean;
}

// 目标字段对应的图标
const fieldIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  goal: Target,
  background: BookOpen,
  targetOutcome: Sparkles,
  cognitiveStyle: Zap,
  general: Heart,
};

// 目标字段对应的颜色
const fieldColors: Record<string, string> = {
  goal: "bg-violet-500",
  background: "bg-blue-500",
  targetOutcome: "bg-emerald-500",
  cognitiveStyle: "bg-amber-500",
  general: "bg-rose-500",
};

/**
 * 卡片样式选项
 */
function CardOption({
  option,
  onClick,
  icon: Icon,
  delay,
}: {
  option: string;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  delay: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: "spring", bounce: 0.3 }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex-1 min-w-[140px] p-4 bg-white rounded-2xl border border-black/[0.06] shadow-lg shadow-black/5 hover:shadow-xl hover:shadow-black/10 transition-all group"
    >
      <div className="flex items-center justify-between mb-2">
        {Icon && (
          <div className={`p-2 rounded-xl ${fieldColors[Icon.name] || "bg-violet-500"} text-white`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
        <ChevronRight className="w-4 h-4 text-black/20 group-hover:text-black group-hover:translate-x-1 transition-all" />
      </div>
      <p className="text-sm font-medium text-black text-left leading-snug">{option}</p>
    </motion.button>
  );
}

/**
 * 按钮样式选项
 */
function ButtonOption({
  option,
  onClick,
  delay,
}: {
  option: string;
  onClick: () => void;
  delay: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="bg-white/80 backdrop-blur-md border border-black/5 px-6 py-3 rounded-full text-sm font-medium hover:bg-black hover:text-white transition-all shadow-lg shadow-black/5"
    >
      {option}
    </motion.button>
  );
}

/**
 * 图标卡片样式
 */
function IconCardOption({
  option,
  onClick,
  delay,
}: {
  option: string;
  onClick: () => void;
  delay: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, rotate: -10 }}
      animate={{ opacity: 1, rotate: 0 }}
      transition={{ delay, type: "spring" }}
      whileHover={{ rotate: 5, scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-black/[0.06] shadow-lg hover:shadow-xl transition-all min-w-[120px] aspect-square"
    >
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center mb-3 shadow-lg shadow-violet-500/20">
        <Check className="w-6 h-6 text-white" />
      </div>
      <p className="text-xs font-bold text-black text-center leading-snug">{option}</p>
    </motion.button>
  );
}

export function OptionCards({
  question,
  options,
  onSelect,
  style = "card",
  targetField = "general",
  multiSelect = false,
  compact = false,
}: OptionCardsProps) {
  const Icon = fieldIcons[targetField];

  return (
    <div className={`space-y-4 ${compact ? "" : "pb-4"}`}>
      {/* 标题 */}
      {question && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-2"
        >
          {Icon && <Icon className="w-4 h-4 text-black/40" />}
          <h3 className="text-xs font-bold uppercase tracking-widest text-black/40">{question}</h3>
          <div className="flex-1 h-px bg-black/[0.05]" />
        </motion.div>
      )}

      {/* 选项容器 */}
      <div
        className={
          style === "button"
            ? "flex flex-wrap gap-3 justify-end"
            : style === "chip"
              ? "flex flex-wrap gap-2"
              : "grid grid-cols-2 md:grid-cols-4 gap-3"
        }
      >
        {options.map((option, idx) => {
          const delay = idx * 0.05;

          if (style === "card") {
            return (
              <CardOption
                key={option}
                option={option}
                onClick={() => onSelect(option)}
                icon={Icon}
                delay={delay}
              />
            );
          }

          if (style === "icon") {
            return (
              <IconCardOption
                key={option}
                option={option}
                onClick={() => onSelect(option)}
                delay={delay}
              />
            );
          }

          return (
            <ButtonOption
              key={option}
              option={option}
              onClick={() => onSelect(option)}
              delay={delay}
            />
          );
        })}
      </div>
    </div>
  );
}
