"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function ManifestingOverlay({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1 }}
          className="fixed inset-0 z-[1000] bg-black flex items-center justify-center overflow-hidden"
        >
          {/* Speed lines effect */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                initial={{
                  x: "-100%",
                  y: `${Math.random() * 100}%`,
                  opacity: 0,
                }}
                animate={{ x: "200%", opacity: [0, 1, 0] }}
                transition={{
                  duration: 0.5 + Math.random() * 0.5,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                }}
                className="absolute w-64 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent"
              />
            ))}
          </div>

          <motion.div
            initial={{ scale: 0.5, opacity: 0, filter: "blur(20px)" }}
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="text-center space-y-12 relative z-10"
          >
            <div className="relative inline-block">
              <motion.div
                animate={{
                  rotate: 360,
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                  scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                }}
                className="w-32 h-32 rounded-[48px] bg-white flex items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.3)]"
              >
                <Sparkles className="w-12 h-12 text-black" />
              </motion.div>

              {/* Orbital rings */}
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  animate={{
                    rotate: 360,
                    scale: [1, 1.1 + i * 0.1, 1],
                  }}
                  transition={{
                    rotate: {
                      duration: 10 + i * 5,
                      repeat: Infinity,
                      ease: "linear",
                    },
                    scale: {
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    },
                  }}
                  className="absolute inset-[-20px] rounded-[60px] border border-white/10"
                />
              ))}
            </div>

            <div className="space-y-4">
              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-5xl md:text-7xl font-bold tracking-tighter text-white"
              >
                Architecting Reality
              </motion.h2>
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-white/40 uppercase text-xs font-bold tracking-[0.6em]"
              >
                Synchronizing Neural Pathways
              </motion.p>
            </div>
          </motion.div>

          {/* Final flash before redirect */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 1] }}
            transition={{ times: [0, 0.9, 1], duration: 4 }}
            className="absolute inset-0 bg-white z-[1100] pointer-events-none"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
