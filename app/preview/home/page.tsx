import { ArrowRight, Check, Dot, GraduationCap } from "lucide-react";
import { IBM_Plex_Sans, Instrument_Serif } from "next/font/google";
import Link from "next/link";
import { PreviewHeroInput } from "@/components/home-preview/PreviewHeroInput";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
});

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const transcript = [
  {
    role: "用户",
    text: "我会一点 SQL，但想系统转数据分析，希望和业务报表结合。",
    tags: undefined,
  },
  {
    role: "系统",
    text: "你更偏向转岗准备，还是先把现在工作的分析能力补齐？",
    tags: ["偏转岗", "先补当前工作", "两者都要"],
  },
  {
    role: "用户",
    text: "两者都要，但希望两个月内有明显提升。",
    tags: undefined,
  },
];

const courseOutline = [
  {
    index: "01",
    title: "SQL 查询与数据拆解",
    detail: "过滤、聚合、多表关联、业务问题翻译成查询",
  },
  {
    index: "02",
    title: "Python 清洗与分析",
    detail: "Pandas 工作流、清洗逻辑、分析结果组织",
  },
  {
    index: "03",
    title: "可视化与业务表达",
    detail: "指标体系、图表叙事、周报与复盘输出",
  },
];

export default function HomePreviewPage() {
  return (
    <main className={`${body.className} min-h-screen bg-[#f4f1ea] text-[#111214]`}>
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),transparent_30%),linear-gradient(180deg,#f4f1ea_0%,#f8f6f2_100%)]" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(17,18,20,0.28)_1px,transparent_1px),linear-gradient(90deg,rgba(17,18,20,0.28)_1px,transparent_1px)] [background-size:96px_96px]" />

        <div className="relative mx-auto max-w-[1480px] px-6 pb-24 pt-8 md:px-10 md:pt-10">
          <header className="flex items-center justify-between">
            <Link href="/" className="text-sm uppercase tracking-[0.3em] text-black/34">
              NexusNote Preview
            </Link>
            <Link
              href="/interview"
              className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white/70 px-4 py-2 text-sm text-black/58 transition-colors hover:bg-white"
            >
              进入访谈
              <ArrowRight className="h-4 w-4" />
            </Link>
          </header>

          <section className="grid gap-12 pt-14 md:grid-cols-[0.78fr_1.22fr] md:items-start md:gap-10 md:pt-20">
            <div className="max-w-2xl pt-2">
              <p className="text-[11px] uppercase tracking-[0.32em] text-black/34">
                AI learning system
              </p>

              <h1
                className={`${display.className} mt-6 text-[3.9rem] leading-[0.88] tracking-[-0.04em] text-[#111214] md:text-[6.8rem]`}
              >
                首页不该介绍功能。
                <br />
                它应该直接
                <br />
                开始工作。
              </h1>

              <p className="mt-8 max-w-xl text-base leading-8 text-black/56 md:text-lg">
                对你的产品来说，现代感不应该来自花哨视觉，而应该来自一种明确感：
                用户一进来，就知道这里会把学习目标压缩成课程。
              </p>

              <div className="mt-10 space-y-3">
                {[
                  "一个主入口：课程访谈",
                  "一个主过程：澄清 -> 生成 -> 开始学习",
                  "一个主结果：一门真正可以开始的课程",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm text-black/52">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-black/8 bg-white">
                      <Check className="h-3.5 w-3.5 text-black/68" />
                    </div>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <section className="grid gap-5 md:grid-cols-[0.95fr_1.05fr]">
              <PreviewHeroInput />

              <div className="grid gap-5 md:grid-rows-[0.88fr_1.12fr]">
                <article className="rounded-[30px] border border-black/8 bg-white p-5 shadow-[0_18px_70px_-52px_rgba(15,23,42,0.16)]">
                  <div className="flex items-center justify-between border-b border-black/6 pb-3">
                    <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-black/34">
                      <GraduationCap className="h-3.5 w-3.5" />
                      访谈正在发生
                    </div>
                    <span className="text-[11px] text-black/28">3 turns</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {transcript.map((item, index) => (
                      <div
                        key={`${item.role}-${index}`}
                        className={`rounded-[22px] px-4 py-3 ${
                          item.role === "用户"
                            ? "ml-10 bg-[#ede8de]"
                            : "mr-4 border border-black/6 bg-[#faf8f4]"
                        }`}
                      >
                        <p className="text-[10px] uppercase tracking-[0.2em] text-black/32">
                          {item.role}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-black/72">{item.text}</p>

                        {Array.isArray(item.tags) ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {item.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full border border-black/6 bg-white px-2.5 py-1 text-[11px] text-black/52"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </article>

                <article className="rounded-[30px] border border-black/8 bg-[#fbfaf7] p-5 shadow-[0_18px_70px_-52px_rgba(15,23,42,0.12)]">
                  <div className="flex items-center justify-between border-b border-black/6 pb-3">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-black/34">
                      生成中的课程
                    </p>
                    <span className="text-[11px] text-black/30">3 章 · 26 小时</span>
                  </div>

                  <div className="mt-5">
                    <h2
                      className={`${display.className} text-[2.4rem] leading-[0.95] text-[#111214]`}
                    >
                      SQL 与数据分析路线
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-black/52">
                      一次访谈后，首页就应该让用户感受到结果已经出现了，而不是还停留在“我能帮你做什么”的介绍阶段。
                    </p>
                  </div>

                  <div className="mt-6 space-y-3">
                    {courseOutline.map((chapter) => (
                      <div
                        key={chapter.title}
                        className="flex items-start gap-4 rounded-[22px] border border-black/6 bg-white px-4 py-4"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#121315] text-xs font-medium text-white">
                          {chapter.index}
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-black/78">{chapter.title}</h3>
                          <p className="mt-1 text-sm leading-6 text-black/46">{chapter.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            </section>
          </section>

          <section className="mt-16 flex items-center gap-3 text-sm text-black/38 md:mt-20">
            <Dot className="h-5 w-5" />
            这不是最终视觉稿，而是一个“更像产品本身”的首页方向预览。
          </section>
        </div>
      </div>
    </main>
  );
}
