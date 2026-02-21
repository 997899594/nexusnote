/**
 * Chat Page - Legacy Style Home
 */

"use client";

import { HeroInput } from "@/features/home";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-6rem)] px-4 py-12">
        <HeroInput />
      </div>
    </main>
  );
}
