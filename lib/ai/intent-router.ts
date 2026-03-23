/**
 * Intent Router - 意图路由器（规则匹配，零成本）
 *
 * 2026 架构：
 * - 纯规则匹配，无 AI 调用
 * - Chat 检测到 INTERVIEW → 跳转到 /interview 页面
 * - 服务端从 conversation 恢复状态
 */

// 意图类型
export type UserIntent = "CHAT" | "INTERVIEW" | "EDITOR" | "SEARCH";

// 学习意图关键词
const LEARNING_PATTERNS = [
  /我想学/,
  /我要学/,
  /教我/,
  /怎么学/,
  /如何学习/,
  /考研/,
  /备考/,
  /准备.*考试/,
];

// 编辑意图关键词
const EDITOR_PATTERNS = [/帮我.*写/, /修改.*文档/, /编辑/, /改一下/, /重写/, /润色/];

// 搜索意图关键词
const SEARCH_PATTERNS = [/搜索/, /查找/, /找一下/, /有没有.*笔记/];

/**
 * 快速意图检测（基于规则，零成本）
 * 用于低成本快速判断
 */
export function quickIntentDetect(message: string): { intent: UserIntent; topic?: string } | null {
  const msg = message.trim();

  // 检测学习意图
  for (const pattern of LEARNING_PATTERNS) {
    if (pattern.test(msg)) {
      // 提取主题
      const topic = msg
        .replace(/我想学|我要学|教我|怎么学|如何学习/g, "")
        .replace(/[？?！!。，,]/g, "")
        .trim();
      return { intent: "INTERVIEW", topic: topic || msg };
    }
  }

  // 检测编辑意图
  for (const pattern of EDITOR_PATTERNS) {
    if (pattern.test(msg)) {
      return { intent: "EDITOR" };
    }
  }

  // 检测搜索意图
  for (const pattern of SEARCH_PATTERNS) {
    if (pattern.test(msg)) {
      return { intent: "SEARCH" };
    }
  }

  return null;
}

/**
 * 意图路由（同步，纯规则）
 */
export function routeIntent(message: string): { intent: UserIntent; topic?: string } {
  const quickResult = quickIntentDetect(message);
  return quickResult ?? { intent: "CHAT" };
}
