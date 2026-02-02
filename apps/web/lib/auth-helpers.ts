/**
 * Authentication Helpers
 *
 * Utility functions for handling authentication tokens and environment checks.
 * Moved from lib/config.ts to separate concerns.
 */

import { clientEnv } from "@nexusnote/config";

/**
 * Development token for local testing.
 * In production, this should be replaced with actual JWT tokens.
 */
export const DEV_TOKEN = "dev-token";

export function isDevelopment(): boolean {
  return clientEnv.NODE_ENV !== "production";
}

/**
 * Get authentication token.
 * In development, returns the last saved session token if available.
 * In production, strictly requires a valid JWT.
 */
export function getAuthToken(): string {
  if (typeof window === "undefined") return "";

  // 优先从 localStorage 获取（由 SessionWatcher 同步）
  const token = localStorage.getItem("nexusnote_token");
  if (token) return token;

  // 开发环境下回退
  if (isDevelopment()) {
    return "dev-token";
  }

  return "";
}
