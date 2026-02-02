"use client";

import { HeroInput } from "@/components/demo/HeroInput";
import { RecentAccess } from "@/components/demo/RecentAccess";
import { OrganicHeader } from "@/components/create/OrganicHeader";
import { motion } from "framer-motion";

export default function DesignDemoPage() {
  return (
    <div className="min-h-screen bg-[#FDFDFD] relative overflow-hidden font-sans selection:bg-black/10 selection:text-black">
      {/* Organic Noise Texture */}
      <div
        className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Subtle Gradient Spot */}
      <div className="absolute top-[-20%] left-[20%] w-[60%] h-[60%] bg-gradient-to-b from-blue-50/50 to-transparent blur-[120px] rounded-full pointer-events-none" />

      {/* Responsive Header */}
      <OrganicHeader />

      {/* Main Content */}
      <main className="relative z-10 flex flex-col items-center pt-[18vh] md:pt-[20vh] px-4 md:px-6 w-full max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-8 md:mb-12 w-full"
        >
          <h1 className="text-4xl md:text-6xl font-bold text-black tracking-tight mb-4 leading-[1.1]">
            What do you want to <span className="text-black/30">know</span>?
          </h1>
        </motion.div>

        <div className="w-full max-w-3xl">
          <HeroInput />
        </div>

        <div className="mt-8 md:mt-16 w-full max-w-3xl">
          <RecentAccess />
        </div>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-6 w-full text-center text-black/20 text-[10px] font-mono uppercase tracking-widest z-10 hidden md:block">
        AI Native OS • v3.0.0
      </footer>
    </div>
  );
}
