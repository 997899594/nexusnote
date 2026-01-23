/**
 * Client-side Configuration
 *
 * Single source of truth for all client-side configuration values.
 * Reads from environment variables with sensible defaults.
 */

// ============================================
// API & WebSocket URLs
// ============================================

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
export const COLLAB_URL = process.env.NEXT_PUBLIC_COLLAB_URL || 'ws://localhost:1234'

// ============================================
// Authentication
// ============================================

/**
 * Development token for local testing.
 * In production, this should be replaced with actual JWT tokens.
 */
export const DEV_TOKEN = 'dev-token'

export function isDevelopment(): boolean {
  return process.env.NODE_ENV !== 'production'
}

/**
 * Get authentication token.
 * In development, returns dev token. In production, should get from auth provider.
 */
export function getAuthToken(): string {
  // TODO: In production, get token from auth provider (localStorage, cookie, etc.)
  if (isDevelopment()) {
    return DEV_TOKEN
  }
  // Production: should integrate with your auth provider
  return localStorage.getItem('nexusnote_token') || ''
}

// ============================================
// Timeouts & Limits
// ============================================

export const config = {
  api: {
    url: API_URL,
    timeout: 30000, // 30 seconds
  },
  ai: {
    baseUrl: process.env.NEXT_PUBLIC_AI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.NEXT_PUBLIC_AI_API_KEY || '',
    model: process.env.NEXT_PUBLIC_AI_MODEL || 'gpt-4o-mini',
  },
  collaboration: {
    url: COLLAB_URL,
    reconnectInterval: 3000,
  },
  rag: {
    timeout: 5000,
    retries: 2,
  },
  snapshot: {
    intervalMs: 5 * 60 * 1000, // 5 minutes
    maxPerDocument: 100,
  },
} as const

export default config
