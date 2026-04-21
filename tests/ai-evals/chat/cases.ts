import { createEvalSuite } from "../runner";

export const chatEvalSuite = createEvalSuite({
  domain: "chat",
  version: "v2",
  cases: [
    {
      id: "chat-basic-explain-rag-concisely",
      title: "通用聊天应直接解释概念而不乱调用能力",
      domain: "chat",
      promptVersion: "chat-basic@v1",
      input: {
        message: "用简单的话解释一下 RAG 是什么，别太学术。",
      },
      expectations: [
        "回答应直接解释 RAG 的基本含义和作用",
        "语气应简洁清晰，不要变成泛泛营销文案",
        "在没有必要时不应依赖课程或笔记上下文",
      ],
      regression: {
        minOutputLength: 40,
        requiredSubstrings: ["RAG", "检索"],
        forbiddenSubstrings: ["tool-", "data-"],
        forbiddenPatterns: ['"type"\\s*:'],
      },
      tags: ["chat-basic", "clarity"],
    },
    {
      id: "chat-basic-practical-postgres-advice",
      title: "通用聊天应给出可执行建议",
      domain: "chat",
      promptVersion: "chat-basic@v1",
      input: {
        message: "我的 PostgreSQL 查询突然变慢了，排查时先看什么？",
      },
      expectations: [
        "回答应给出排查优先级，而不是只给抽象原则",
        "至少覆盖执行计划、索引、最近变更或数据量变化等常见方向",
        "输出应适合工程场景快速使用",
      ],
      regression: {
        minOutputLength: 50,
        requiredSubstrings: ["执行计划", "索引"],
        forbiddenSubstrings: ["tool-", "data-"],
        forbiddenPatterns: ['"type"\\s*:'],
      },
      tags: ["chat-basic", "practicality"],
    },
  ],
});
