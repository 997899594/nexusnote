/**
 * Pending Chat Store - 桥接 HeroInput → ChatPanel
 *
 * 架构职责：
 * - 在路由跳转的瞬间，暂存用户输入（因为路由跳转时组件重新挂载，状态丢失）
 * - 生命周期极短：HeroInput setInput → 路由跳转 → ChatPanel 读取 → 清空
 * - 不持久化到 localStorage（会话很快就有了真实存储）
 *
 * 数据流：
 * 1. HeroInput: id = nanoid(), set(id, message)
 * 2. Router push /chat/[id]
 * 3. ChatPanel: 挂载时从 store 读 message（通过 id 匹配）
 * 4. useChatSession: 消息发出后 clear()
 */

import { create } from "zustand";

interface PendingChat {
  id: string;
  message: string;
}

interface PendingChatStore {
  pending: PendingChat | null;

  /**
   * 设置待发送消息（HeroInput 调用）
   */
  set: (id: string, message: string) => void;

  /**
   * 获取待发送消息（ChatPanel 调用，通过 id 匹配）
   */
  get: (id: string) => string | null;

  /**
   * 清空（useChatSession 发送后调用）
   */
  clear: () => void;
}

export const usePendingChatStore = create<PendingChatStore>((set, get) => ({
  pending: null,

  set: (id, message) => set({ pending: { id, message } }),

  get: (id) => {
    const { pending } = get();
    return pending?.id === id ? pending.message : null;
  },

  clear: () => set({ pending: null }),
}));
