"use client";

import React from "react";
import { Streamdown } from "streamdown";
import { mermaid } from "@streamdown/mermaid";
import { math } from "@streamdown/math";
import { code } from "@streamdown/code";
import { cjk } from "@streamdown/cjk";

interface ContentRendererProps {
  content: string;
  className?: string;
}

/**
 * NexusNote 2026 Content Renderer
 *
 * 系统级特性：
 * 1. 采用 Streamdown 引擎，支持流式渲染与多模态扩展
 * 2. 2026 Fluid Typography: 基于视口的流式排版系统
 * 3. 深度集成 Mermaid (图表), KaTeX (数学), Shiki (代码)
 * 4. 针对中文优化的排版（CJK 扩展）
 */
export function ContentRenderer({
  content,
  className = "",
}: ContentRendererProps) {
  if (!content) return null;

  return (
    <div
      className={`
        content-renderer-root
        prose prose-zinc prose-xl max-w-none
        /* 2026 Fluid Typography & Spacing */
        prose-headings:font-black prose-headings:tracking-tighter prose-headings:text-black
        prose-h1:text-[clamp(2.5rem,8vw,4.5rem)] prose-h1:leading-[1.1] prose-h1:mb-12
        prose-h2:text-[clamp(1.8rem,5vw,2.8rem)] prose-h2:leading-[1.2] prose-h2:mt-20 prose-h2:mb-8
        prose-h3:text-[clamp(1.4rem,3vw,1.8rem)] prose-h3:mt-12 prose-h3:mb-6
        
        /* Body Text - Focus on Readability */
        prose-p:text-black/80 prose-p:leading-[1.9] prose-p:font-serif prose-p:mb-10 prose-p:text-[clamp(1.1rem,2vw,1.25rem)]
        
        /* Rich Components Styles */
        prose-strong:text-black prose-strong:font-black
        prose-code:bg-black/5 prose-code:text-black prose-code:px-2 prose-code:py-0.5 prose-code:rounded-lg prose-code:before:content-none prose-code:after:content-none
        prose-img:rounded-[2.5rem] prose-img:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] prose-img:my-20
        
        /* Blockquote - 2026 Aesthetic */
        prose-blockquote:border-l-0 prose-blockquote:pl-12 prose-blockquote:relative
        prose-blockquote:before:content-['"'] prose-blockquote:before:absolute prose-blockquote:before:-left-4 prose-blockquote:before:-top-8
        prose-blockquote:before:text-[8rem] prose-blockquote:before:text-black/5 prose-blockquote:before:font-serif
        prose-blockquote:italic prose-blockquote:text-[clamp(1.2rem,2.5vw,1.8rem)] prose-blockquote:font-serif prose-blockquote:text-black/70 prose-blockquote:leading-relaxed
        
        /* Interactive Elements */
        selection:bg-black selection:text-white
        ${className}
      `}
    >
      <Streamdown plugins={{ code, mermaid, math, cjk }}>{content}</Streamdown>

      <style jsx global>{`
        .content-renderer-root .mermaid {
          display: flex;
          justify-content: center;
          margin: 4rem 0;
          padding: 2rem;
          background: rgba(0, 0, 0, 0.02);
          border-radius: 2rem;
        }
        .content-renderer-root pre {
          background: #18181b !important;
          border-radius: 1.5rem !important;
          padding: 2rem !important;
          margin: 3rem 0 !important;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
        .content-renderer-root ul,
        .content-renderer-root ol {
          margin-top: 2rem;
          margin-bottom: 2rem;
        }
        .content-renderer-root li {
          margin-bottom: 1rem;
          padding-left: 0.5rem;
        }
        /* Custom scrollbar for code blocks */
        .content-renderer-root pre::-webkit-scrollbar {
          height: 8px;
        }
        .content-renderer-root pre::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
