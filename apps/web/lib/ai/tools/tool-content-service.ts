/**
 * Tool Content Generation Service
 *
 * 专门为 AI 工具生成结构化内容的服务
 * 使用 generateText 确保类型安全的结果
 *
 * 功能：
 * - LLM 内容生成
 * - 降级（Fallback）实现
 * - 重试机制（指数退避）
 * - 请求去重缓存
 */

import { generateText } from "ai";
import { z } from "zod";
import { createTelemetryConfig } from "@/features/shared/ai/langfuse";
import { registry } from "@/features/shared/ai/registry";

// ============================================
// Error Handling & Retry Utilities
// ============================================

class ToolError extends Error {
  constructor(
    message: string,
    public code: "RATE_LIMIT" | "TIMEOUT" | "INVALID_RESPONSE" | "MODEL_ERROR" | "UNKNOWN",
    public retryable: boolean = true,
  ) {
    super(message);
    this.name = "ToolError";
  }
}

/**
 * 带重试的异步执行
 * @param fn 要执行的异步函数
 * @param maxRetries 最大重试次数
 * @param baseDelay 基础延迟（毫秒）
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // 判断是否可重试
      const toolError = error instanceof ToolError ? error : undefined;
      if (toolError && !toolError.retryable) {
        throw error;
      }

      // 最后一次尝试失败，不再重试
      if (attempt === maxRetries) {
        throw error;
      }

      // 指数退避延迟
      const delay = baseDelay * 2 ** attempt + Math.random() * 500;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("Unknown error in retry logic");
}

/**
 * 简单的内存缓存（用于请求去重）
 */
class SimpleCache<K, V> {
  private cache = new Map<K, { value: V; expiry: number }>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  set(key: K, value: V, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl,
    });
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  getAs<T = V>(key: K): T | undefined {
    return this.get(key) as T | undefined;
  }

  clear(): void {
    this.cache.clear();
  }
}

// 创建全局缓存实例
const contentCache = new SimpleCache<string, any>();

// 生成缓存键
function generateCacheKey(type: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((k) => `${k}=${JSON.stringify(params[k])}`)
    .join("&");
  return `${type}:${sortedParams}`;
}

// ============================================
// Quiz Generation
// ============================================

const QuizQuestionSchema = z.object({
  id: z.number(),
  type: z.enum(["multiple_choice", "true_false", "fill_blank"]),
  question: z.string(),
  options: z.array(z.string()).optional(),
  answer: z.union([z.string(), z.number()]),
  explanation: z.string().optional(),
});

const QuizQuestionsSchema = z.object({
  questions: z.array(QuizQuestionSchema),
});

export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export async function generateQuizQuestions(
  content: string,
  questionCount: number,
  difficulty: "easy" | "medium" | "hard",
  types?: ("multiple_choice" | "true_false" | "fill_blank")[],
): Promise<QuizQuestion[]> {
  const cacheKey = generateCacheKey("quiz", { content, questionCount, difficulty, types });
  const cached = contentCache.getAs<QuizQuestion[]>(cacheKey);
  if (cached) {
    console.log("[ToolContentService] Cache hit for quiz generation");
    return cached;
  }

  const difficultyMap = {
    easy: "简单",
    medium: "中等",
    hard: "困难",
  };

  const typeDescriptions = types?.join("、") || "单选题、判断题和填空题";

  const prompt = `你是一个专业的教育测验设计师。请根据以下内容生成 ${questionCount} 道${difficultyMap[difficulty]}难度的${typeDescriptions}。

【内容】
${content}

【要求】
1. 题目要考察对核心概念的理解，而非死记硬背
2. 单选题提供4个选项，只有一个正确答案
3. 判断题只有"正确"或"错误"两个选项
4. 填空题答案要简洁明确
5. 每题提供简短的解释说明为什么这样回答

请以 JSON 格式返回，结构如下：
{
  "questions": [
    {
      "id": 1,
      "type": "multiple_choice",
      "question": "题目内容",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "answer": 0,
      "explanation": "解释说明"
    }
  ]
}`;

  try {
    const result = await withRetry(
      async () => {
        const model = registry.fastModel || registry.chatModel;
        if (!model) {
          throw new ToolError("AI model not available", "MODEL_ERROR", false);
        }

        const response = await generateText({
          model,
          prompt,
          experimental_telemetry: createTelemetryConfig("tool-quiz-generation", {
            questionCount,
            difficulty,
            contentLength: content.length,
          }),
        });

        // 验证响应格式
        const parsed = JSON.parse(response.text);
        try {
          const validated = QuizQuestionsSchema.parse(parsed);
          return { questions: validated.questions };
        } catch (_zodError) {
          throw new ToolError("Invalid response format from AI", "INVALID_RESPONSE", true);
        }
      },
      2,
      1000,
    );

    contentCache.set(cacheKey, result.questions);
    return result.questions;
  } catch (error) {
    console.error("[ToolContentService] Quiz generation failed after retries:", error);
    // 返回降级题目
    return generateFallbackQuiz(content, questionCount, difficulty, types);
  }
}

function generateFallbackQuiz(
  content: string,
  questionCount: number,
  _difficulty: "easy" | "medium" | "hard",
  types?: ("multiple_choice" | "true_false" | "fill_blank")[],
): QuizQuestion[] {
  const topic = content.length > 50 ? `${content.slice(0, 47)}...` : content;
  const questions: QuizQuestion[] = [];
  const defaultTypes = types || ["multiple_choice", "true_false", "fill_blank"];

  for (let i = 0; i < Math.min(questionCount, 10); i++) {
    const type = defaultTypes[i % defaultTypes.length];

    if (type === "multiple_choice") {
      questions.push({
        id: i + 1,
        type: "multiple_choice",
        question: `关于"${topic}"的以下哪个描述是正确的？`,
        options: [
          "这是第一个选项，描述概念的特征",
          "这是第二个选项，包含可能的错误信息",
          "这是第三个选项，描述另一个特征",
          "这是正确答案",
        ],
        answer: 3,
        explanation: "正确答案是 D，因为这是基于内容的准确描述。",
      });
    } else if (type === "true_false") {
      questions.push({
        id: i + 1,
        type: "true_false",
        question: `"${topic}"的核心概念是否包含以下要素？`,
        answer: "true",
        explanation: "这个陈述是正确的，因为它准确反映了核心概念。",
      });
    } else {
      questions.push({
        id: i + 1,
        type: "fill_blank",
        question: `在"${topic}"中，最重要的概念是______。`,
        answer: "核心概念",
        explanation: "这是该主题的核心概念，理解它对掌握整个内容至关重要。",
      });
    }
  }

  return questions;
}

// ============================================
// Mind Map Generation
// ============================================

// 使用 interface 避免递归类型推断问题
export interface MindMapNodeData {
  id: string;
  label: string;
  children?: MindMapNodeData[];
}

const MindMapNodeSchema: z.ZodType<MindMapNodeData> = z.object({
  id: z.string(),
  label: z.string(),
  children: z.array(z.lazy(() => MindMapNodeSchema)).optional(),
});

const MindMapSchema = z.object({
  nodes: z.array(MindMapNodeSchema),
});

export async function generateMindMapNodes(
  topic: string,
  content: string | undefined,
  maxDepth: number,
): Promise<MindMapNodeData[]> {
  const cacheKey = generateCacheKey("mindmap", { topic, content, maxDepth });
  const cached = contentCache.getAs<MindMapNodeData[]>(cacheKey);
  if (cached) {
    console.log("[ToolContentService] Cache hit for mindmap generation");
    return cached;
  }

  const contentText = content || topic;

  const prompt = `你是一个专业的知识结构设计师。请为以下主题创建一个思维导图结构。

【主题】
${topic}

【内容】
${contentText}

【要求】
1. 创建 ${Math.min(4, maxDepth)} 个主要分支
2. 每个分支包含 2-4 个子节点
3. 节点标签简洁明了，通常 2-6 个字
4. 最大层级深度为 ${maxDepth} 层
5. 结构清晰，逻辑层次分明

请以 JSON 格式返回，结构如下：
{
  "nodes": [
    {
      "id": "branch-0",
      "label": "分支名称",
      "children": [
        { "id": "node-0-0", "label": "子节点1" },
        { "id": "node-0-1", "label": "子节点2" }
      ]
    }
  ]
}`;

  try {
    const result = await withRetry(
      async () => {
        const model = registry.chatModel;
        if (!model) {
          throw new ToolError("AI model not available", "MODEL_ERROR", false);
        }

        const response = await generateText({
          model,
          prompt,
          experimental_telemetry: createTelemetryConfig("tool-mindmap-generation", {
            topic,
            maxDepth,
          }),
        });

        // 验证响应格式
        const parsed = JSON.parse(response.text);
        try {
          const validated = MindMapSchema.parse(parsed);
          return { nodes: validated.nodes };
        } catch (_zodError) {
          throw new ToolError("Invalid response format from AI", "INVALID_RESPONSE", true);
        }
      },
      2,
      1000,
    );

    contentCache.set(cacheKey, result.nodes);
    return result.nodes;
  } catch (error) {
    console.error("[ToolContentService] MindMap generation failed after retries:", error);
    return generateFallbackMindMap(topic, maxDepth);
  }
}

function generateFallbackMindMap(_topic: string, maxDepth: number): MindMapNodeData[] {
  const branches = [
    {
      label: "核心概念",
      children: [{ label: "定义与特征" }, { label: "关键要素" }, { label: "适用场景" }],
    },
    {
      label: "实践应用",
      children: [{ label: "使用方法" }, { label: "注意事项" }, { label: "最佳实践" }],
    },
    {
      label: "深入理解",
      children: [{ label: "底层原理" }, { label: "与其他概念的关系" }, { label: "常见问题" }],
    },
    {
      label: "延伸拓展",
      children: [{ label: "相关资源" }, { label: "学习路径" }],
    },
  ];

  return branches.map((branch, idx) => {
    const nodeId = `branch-${idx}`;
    const node: MindMapNodeData = {
      id: nodeId,
      label: branch.label,
    };

    if (maxDepth > 1 && branch.children) {
      node.children = branch.children.map((child, childIdx) => {
        const childId = `node-${idx}-${childIdx}`;
        const childNode: MindMapNodeData = {
          id: childId,
          label: child.label,
        };

        if (maxDepth > 2 && childIdx === 0) {
          childNode.children = [
            { id: `${childId}-1`, label: "要点一" },
            { id: `${childId}-2`, label: "要点二" },
          ];
        }

        return childNode;
      });
    }

    return node;
  });
}

// ============================================
// Summary Generation
// ============================================

const _SummarySchema = z.object({
  content: z.string(),
});

export async function generateSummaryContent(
  content: string,
  length: "brief" | "medium" | "detailed",
  style: "bullet_points" | "paragraph" | "key_takeaways",
): Promise<string> {
  const cacheKey = generateCacheKey("summary", { content: content.slice(0, 100), length, style });
  const cached = contentCache.getAs<string>(cacheKey);
  if (cached) {
    console.log("[ToolContentService] Cache hit for summary generation");
    return cached;
  }

  const lengthMap = {
    brief: "1-2句话",
    medium: "一段话",
    detailed: "多段落",
  };

  const styleMap = {
    bullet_points: "要点列表格式（每行以 • 开头）",
    paragraph: "段落形式",
    key_takeaways: "编号列表格式（1. 2. 3.）",
  };

  const prompt = `你是一个专业的内容摘要专家。请对以下内容进行摘要。

【原始内容】
${content}

【要求】
1. 摘要长度：${lengthMap[length]}
2. 摘要风格：${styleMap[style]}
3. 保留核心信息，去除冗余内容
4. 语言简洁，逻辑清晰

请直接输出摘要内容，不要有任何其他说明文字。`;

  try {
    const result = await withRetry(
      async () => {
        const model = registry.fastModel || registry.chatModel;
        if (!model) {
          throw new ToolError("AI model not available", "MODEL_ERROR", false);
        }

        const response = await generateText({
          model,
          prompt,
          experimental_telemetry: createTelemetryConfig("tool-summary-generation", {
            length,
            style,
            contentLength: content.length,
          }),
        });

        return response.text.trim();
      },
      2,
      1000,
    );

    contentCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error("[ToolContentService] Summary generation failed after retries:", error);
    return generateFallbackSummary(content, length, style);
  }
}

function generateFallbackSummary(
  content: string,
  length: "brief" | "medium" | "detailed",
  style: "bullet_points" | "paragraph" | "key_takeaways",
): string {
  const sentences = content.split(/[。！？.!?]/).filter((s) => s.trim().length > 10);

  if (style === "bullet_points") {
    const points = sentences.slice(0, length === "brief" ? 2 : length === "medium" ? 4 : 6);
    return points.map((s) => `• ${s.trim()}`).join("\n");
  }

  if (style === "key_takeaways") {
    const takeaways = sentences.slice(0, length === "brief" ? 2 : length === "medium" ? 3 : 5);
    return takeaways.map((s, i) => `${i + 1}. ${s.trim()}`).join("\n");
  }

  // paragraph
  const summaryText = sentences
    .slice(0, length === "brief" ? 2 : length === "medium" ? 4 : 7)
    .join("。");
  return `${summaryText}。`;
}

// ============================================
// Streamable Content Generation (for true Generative UI)
// ============================================

/**
 * 流式生成测验题目
 * 用于实现真正的 Generative UI - 题目逐个流式显示
 */
export async function streamQuizQuestions(
  content: string,
  questionCount: number,
  onQuestion: (question: QuizQuestion, index: number) => void,
  difficulty?: "easy" | "medium" | "hard",
  types?: ("multiple_choice" | "true_false" | "fill_blank")[],
): Promise<QuizQuestion[]> {
  const questions = await generateQuizQuestions(
    content,
    questionCount,
    difficulty || "medium",
    types,
  );

  // 逐个返回题目，模拟流式效果
  for (let i = 0; i < questions.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 200)); // 每题间隔 200ms
    onQuestion(questions[i], i);
  }

  return questions;
}

/**
 * 流式生成思维导图节点
 * 用于实现真正的 Generative UI - 分支逐个展开
 */
export async function streamMindMapNodes(
  topic: string,
  onBranch: (branch: MindMapNodeData, index: number) => void,
  maxDepth: number,
  content?: string,
): Promise<MindMapNodeData[]> {
  const nodes = await generateMindMapNodes(topic, content, maxDepth);

  // 逐个返回分支，模拟流式效果
  for (let i = 0; i < nodes.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 300)); // 每分支间隔 300ms
    onBranch(nodes[i], i);
  }

  return nodes;
}

// ============================================
// Cache Management (for testing/debugging)
// ============================================

export function clearContentCache() {
  contentCache.clear();
}

export function getCacheSize(): number {
  return (contentCache as any).cache.size;
}
