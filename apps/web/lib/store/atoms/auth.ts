/**
 * Authentication State
 *
 * 用户认证相关的全局状态
 */

import { atom } from "jotai";

/**
 * 当前用户 ID
 */
export const userIdAtom = atom<string | null>(null);

/**
 * 当前会话 ID
 */
export const sessionIdAtom = atom<string | null>(null);

/**
 * 用户是否已登录
 */
export const isAuthenticatedAtom = atom((get) => {
  return get(userIdAtom) !== null;
});
