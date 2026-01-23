/**
 * Server Environment Configuration
 *
 * Uses @nexusnote/config for centralized configuration management.
 */

import {
  parseServerEnv,
  buildRuntimeConfig,
  logServerConfig,
  type ServerEnv,
  type RuntimeConfig,
} from '@nexusnote/config'

// Parse and validate environment variables
export const env: ServerEnv = parseServerEnv()

// Build runtime config from environment
export const config: RuntimeConfig = buildRuntimeConfig(env)

// Re-export for backward compatibility
export type Env = ServerEnv

// Log configuration on startup
export { logServerConfig }

// Convenience function for startup logging
export function logEnvConfig() {
  logServerConfig(env)
}
