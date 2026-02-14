/**
 * Prompt Registry — 可版本化的 Prompt 管理
 *
 * 设计思路：
 * 1. 每个 prompt 有 id + version，支持版本追踪
 * 2. 模板使用 {{variable}} 占位符
 * 3. render 时自动检查必需变量
 * 4. 后续可接入 Langfuse Prompt Management 实现 A/B 测试
 */

export interface PromptTemplate {
  /** 唯一标识 */
  id: string;
  /** 版本号，用于追踪 */
  version: number;
  /** 模板内容，{{variable}} 为占位符 */
  template: string;
  /** 声明需要的变量名 */
  variables: string[];
  /** 可选描述 */
  description?: string;
}

export class PromptRegistry {
  private prompts = new Map<string, PromptTemplate>();

  /** 注册一个 prompt 模板 */
  register(prompt: PromptTemplate): void {
    this.prompts.set(prompt.id, prompt);
  }

  /**
   * 渲染 prompt：替换所有 {{variable}} 占位符
   * @throws 如果 prompt 不存在或缺少必需变量
   */
  render(id: string, vars: Record<string, string>): string {
    const prompt = this.prompts.get(id);
    if (!prompt) {
      throw new Error(`[PromptRegistry] Prompt not found: ${id}`);
    }

    const missing = prompt.variables.filter((v) => !(v in vars));
    if (missing.length > 0) {
      throw new Error(`[PromptRegistry] Prompt "${id}" missing variables: ${missing.join(", ")}`);
    }

    let result = prompt.template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replaceAll(`{{${key}}}`, value);
    }
    return result;
  }

  /** 获取 prompt 元信息（用于 Langfuse 追踪） */
  getMeta(id: string): { id: string; version: number } | null {
    const prompt = this.prompts.get(id);
    return prompt ? { id: prompt.id, version: prompt.version } : null;
  }

  /** 获取所有已注册的 prompt ID 列表 */
  list(): string[] {
    return Array.from(this.prompts.keys());
  }
}
