"use client";

import { motion } from "framer-motion";
import { ArrowRight, Lightbulb, Rocket, Sparkles, Target } from "lucide-react";
import { useState } from "react";

interface CreateHeroProps {
  onGenerate: (goal: string) => void;
  isGenerating: boolean;
}

export function CreateHero({ onGenerate, isGenerating }: CreateHeroProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isGenerating) {
      onGenerate(input.trim());
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-12 md:py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-12"
      >
        {/* Immersive Heading */}
        <div className="space-y-6">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/[0.03] border border-black/[0.05] text-[10px] font-bold uppercase tracking-[0.2em] text-black/40"
          >
            <Sparkles className="w-3 h-3" />
            AI Personal Architect
          </motion.div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-black leading-[1.1]">
            What is your next <br />
            <span className="text-black/20 italic font-serif">learning frontier</span>?
          </h1>
        </div>

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-8">
          <div className="relative group">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isGenerating}
              placeholder="Describe your goal (e.g. Master Quantum Mechanics)"
              className="w-full px-8 py-6 text-xl md:text-2xl bg-white border border-black/[0.08] rounded-[32px] 
                                     shadow-[0_8px_40px_rgba(0,0,0,0.04)] focus:shadow-[0_12px_60px_rgba(0,0,0,0.08)]
                                     focus:border-black outline-none transition-all
                                     disabled:opacity-50 disabled:cursor-not-allowed
                                     placeholder:text-black/20 text-center"
            />
          </div>

          <button
            type="submit"
            disabled={!input.trim() || isGenerating}
            className="group relative inline-flex items-center gap-3 px-10 py-5 bg-black text-white rounded-[24px] font-bold text-lg
                                 hover:scale-[1.02] active:scale-[0.98] transition-all
                                 disabled:bg-black/20 disabled:cursor-not-allowed disabled:active:scale-100
                                 shadow-xl shadow-black/10"
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Architecting...
              </>
            ) : (
              <>
                Begin Analysis
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        {/* Inspiration Tags */}
        <div className="flex flex-wrap justify-center gap-3 opacity-40">
          <InspirationTag
            icon={Lightbulb}
            label="Modern Architecture"
            onClick={() => setInput("Modern Architecture")}
          />
          <InspirationTag
            icon={Target}
            label="Rust Systems"
            onClick={() => setInput("Rust Systems")}
          />
          <InspirationTag
            icon={Rocket}
            label="Space Exploration"
            onClick={() => setInput("Space Exploration")}
          />
        </div>
      </motion.div>
    </div>
  );
}

function InspirationTag({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-full border border-black/10 text-[10px] font-bold uppercase tracking-wider hover:bg-black hover:text-white hover:border-black transition-all"
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}
