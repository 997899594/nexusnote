/**
 * Authentication Helpers
 *
 * Utility functions for handling authentication tokens and environment checks.
 * Moved from lib/config.ts to separate concerns.
 */

import { clientEnv } from "@nexusnote/config";

/**
 * Get the development authentication token from environment.
 * In production, this returns undefined.
 */
function getDevToken(): string | undefined {
  if (clientEnv.NODE_ENV !== "development") {
    return undefined;
  }

  // Read directly from process.env to avoid type issues
  const token = process.env.NEXT_PUBLIC_DEV_AUTH_TOKEN;
  if (!token) {
    // 在开发环境如果没有配置，给出警告
    if (typeof window !== "undefined") {
      console.warn(
        "[Auth] NEXT_PUBLIC_DEV_AUTH_TOKEN not configured. " +
        'Set it in .env.local: openssl rand -base64 24'
      );
    }
  }
  return token;
}

/**
 * Check if a token matches the development auth token.
 */
export function isDevTokenValid(token: string): boolean {
  const devToken = getDevToken();
  return devToken !== undefined && token === devToken;
}

export function isDevelopment(): boolean {
  return clientEnv.NODE_ENV !== "production";
}

/**
 * Get authentication token.
 *
 * - In development: uses NEXT_PUBLIC_DEV_AUTH_TOKEN if set
 * - In production: requires a valid JWT from localStorage
 */
export function getAuthToken(): string {
  if (typeof window === "undefined") return "";

  // 优先从 localStorage 获取（由 SessionWatcher 同步）
  const token = localStorage.getItem("nexusnote_token");
  if (token) return token;

  // 开发环境下回退到环境变量配置的 token
  const devToken = getDevToken();
  if (devToken) {
    return devToken;
  }

  return "";
}
