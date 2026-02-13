/**
 * Web Search Toggle Hook
 *
 * 用于控制 AI 联网搜索功能的开关
 */

import { useAtom } from "jotai";
import { enableWebSearchAtom } from "@/features/shared/atoms/ui";

/**
 * 获取和设置联网搜索状态
 * @returns
 * - webSearchEnabled: 当前是否启用联网搜索
 * - setWebSearchEnabled: 设置联网搜索状态
 * - toggleWebSearch: 切换联网搜索状态
 */
export function useWebSearchToggle() {
  const [enabled, setEnabled] = useAtom(enableWebSearchAtom);

  return {
    webSearchEnabled: enabled,
    setWebSearchEnabled: setEnabled,
    toggleWebSearch: () => setEnabled(!enabled),
  };
}
