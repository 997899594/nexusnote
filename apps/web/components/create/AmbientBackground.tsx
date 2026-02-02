"use client";

import { motion } from "framer-motion";
import { CourseNode } from "@/lib/types/course";

interface AmbientBackgroundProps {
  nodes: CourseNode[];
  isThinking: boolean;
  phase: string;
  progress: number;
}

export function AmbientBackground({
  nodes,
  isThinking,
  phase,
  progress,
}: AmbientBackgroundProps) {
  const getBgClass = () => {
    if (phase === "interview") {
      if (progress < 0.3) return "opacity-20 blur-[120px] scale-90";
      if (progress < 0.7) return "opacity-40 blur-[80px] scale-100";
      return "opacity-60 blur-[40px] scale-110";
    }
    if (phase === "synthesis" || phase === "seeding")
      return "opacity-80 blur-[20px] scale-125";
    return "opacity-40 blur-[100px]";
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
      <div
        className={`absolute inset-0 transition-all duration-[3000ms] ease-in-out ${getBgClass()}`}
      >
        {/* Background Orbs */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={`orb-${i}`}
            animate={{
              scale: isThinking ? [1, 1.5, 1] : [1, 1.1, 1],
              opacity: isThinking ? [0.1, 0.4, 0.1] : [0.05, 0.15, 0.05],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: isThinking ? 3 : 10 + i * 2,
              repeat: Infinity,
              ease: "linear",
            }}
            className="absolute w-[40vw] h-[40vw] rounded-full bg-gradient-to-tr from-black/5 to-transparent blur-[120px] will-change-transform"
            style={{
              left: `${(i % 3) * 30}%`,
              top: `${Math.floor(i / 3) * 40}%`,
            }}
          />
        ))}

        {/* Nodes echoes if available */}
        {nodes.map((node) => (
          <motion.div
            key={`echo-${node.id}`}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0.2, 0.5, 0.2],
              scale: [1, 1.3, 1],
              x: node.x * 1.5,
              y: node.y * 1.5,
            }}
            transition={{
              duration: 4 + Math.random() * 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute w-40 h-40 rounded-full bg-black/[0.03] blur-[60px] will-change-transform"
          />
        ))}

        <div
          className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] bg-gradient-to-tr from-blue-50/20 via-white to-violet-50/20 blur-[150px] rounded-full pointer-events-none opacity-50 will-change-transform" />
      </div>
    </div>
  );
}
