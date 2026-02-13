import { clientEnv, env } from "@nexusnote/config";
import { tool } from "ai";
import { z } from "zod";

/**
 * 生成插图工具 - 使用 DALL-E 3
 */
export const generateIllustrationTool = tool({
  description:
    "根据描述生成一张高质量的插图，用于增强课程内容。返回图片的 URL。请在 Markdown 中以 ![alt](url) 格式插入。",
  inputSchema: z.object({
    prompt: z.string().describe("详细的图片描述，包括风格、构图和核心元素"),
    aspectRatio: z.enum(["1:1", "16:9", "4:3"]).default("16:9").describe("图片宽高比"),
  }),
  execute: async ({ prompt, aspectRatio }) => {
    console.log(`[generateIllustration] 正在为描述生成图片: ${prompt}`);

    try {
      // 使用 302.ai 提供的 OpenAI DALL-E 3 模型
      const apiKey =
        (typeof window === "undefined" ? env.AI_302_API_KEY : undefined) ||
        clientEnv.AI_302_API_KEY;
      const baseURL = "https://api.302.ai/v1";

      if (!apiKey) {
        throw new Error("Missing 302.ai API Key for image generation");
      }

      const response = await fetch(`${baseURL}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: prompt,
          n: 1,
          size: aspectRatio === "16:9" ? "1792x1024" : "1024x1024",
          quality: "standard",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to generate image");
      }

      const data = await response.json();
      const imageUrl = data.data[0].url;

      return {
        success: true,
        imageUrl,
        alt: prompt.slice(0, 50),
      };
    } catch (error) {
      console.error("[generateIllustration] 失败:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "图片生成失败",
      };
    }
  },
});
