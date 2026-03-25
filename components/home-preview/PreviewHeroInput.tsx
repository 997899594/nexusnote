"use client";

import { ArrowUpRight, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const STARTERS = [
  "我想从零开始学 SQL 做数据分析",
  "我想系统学 React，并做一个完整作品集",
  "我想补齐用户研究和产品判断能力",
];

export function PreviewHeroInput() {
  const router = useRouter();
  const [value, setValue] = useState("");

  const submit = () => {
    const message = value.trim();
    if (!message) {
      return;
    }

    router.push(`/interview?msg=${encodeURIComponent(message)}`);
  };

  return (
    <section className="rounded-[28px] border border-black/8 bg-white p-4 shadow-[0_20px_80px_-48px_rgba(15,23,42,0.24)]">
      <div className="flex items-center justify-between border-b border-black/6 pb-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-black/34">开始课程访谈</p>
          <p className="mt-1 text-sm text-black/52">输入一个目标，系统会直接开始追问与生成。</p>
        </div>
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#111214] text-white">
          <Sparkles className="h-4 w-4" />
        </div>
      </div>

      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        rows={3}
        placeholder="例如：我在做运营，想转数据分析，希望 8 周内把 SQL、Python 和业务分析补起来。"
        className="mt-4 min-h-[136px] w-full resize-none border-none bg-transparent text-[15px] leading-8 text-black outline-none placeholder:text-black/24"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {STARTERS.map((starter) => (
          <button
            key={starter}
            type="button"
            onClick={() => setValue(starter)}
            className="rounded-full border border-black/7 bg-[#f5f3ef] px-3 py-1.5 text-xs text-black/58 transition-colors hover:bg-[#ece8df]"
          >
            {starter}
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-black/6 pt-4">
        <p className="text-sm text-black/42">不是问答框，而是课程入口。</p>
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim()}
          className="inline-flex items-center gap-2 rounded-full bg-[#121315] px-5 py-3 text-sm font-medium text-white transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-35"
        >
          开始
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
