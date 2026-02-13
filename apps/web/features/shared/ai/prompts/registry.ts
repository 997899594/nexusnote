/**
 * @deprecated 已迁移到 @nexusnote/ai-core
 * 此文件仅做重导出，方便现有代码过渡。
 */
import { PromptRegistry, type PromptTemplate } from "@nexusnote/ai-core";

export type { PromptTemplate };

/** 全局 Prompt Registry 单例 */
export const promptRegistry = new PromptRegistry();
