/**
 * Database Migration Script
 *
 * Uses drizzle-orm's native migration system for proper version tracking.
 *
 * Usage:
 *   pnpm --filter @nexusnote/db migrate
 *
 * Workflow:
 *   1. Modify src/schema.ts
 *   2. Run: pnpm --filter @nexusnote/db generate
 *   3. Review generated SQL in drizzle/
 *   4. Run: pnpm --filter @nexusnote/db migrate
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { env } from '@nexusnote/config'

const DATABASE_URL = env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set')
  process.exit(1)
}

async function runMigrations() {
  console.log('[Migrate] Starting database migrations...')
  console.log(`[Migrate] Database: ${DATABASE_URL!.replace(/\/\/[^@]+@/, '//***@')}`)

  // Use a separate connection for migrations
  const migrationClient = postgres(DATABASE_URL!, { max: 1 })
  const db = drizzle(migrationClient)

  try {
    // Check PostgreSQL version
    const versionResult = await migrationClient`SELECT version()`
    const versionString = versionResult[0]?.version || 'unknown'
    console.log('[Migrate] PostgreSQL:', versionString.split(',')[0])
    
    // Extract major version number
    const versionMatch = versionString.match(/PostgreSQL (\d+)/)
    const majorVersion = versionMatch ? parseInt(versionMatch[1]) : 0
    console.log('[Migrate] Major version:', majorVersion)
    
    if (majorVersion > 0 && majorVersion < 13) {
      console.error('')
      console.error('╔════════════════════════════════════════════════════════════════╗')
      console.error('║  ❌ PostgreSQL 版本过低                                         ║')
      console.error('╠════════════════════════════════════════════════════════════════╣')
      console.error(`║  当前版本: PostgreSQL ${majorVersion}                           ║`)
      console.error('║  需要版本: PostgreSQL 13+                                       ║')
      console.error('║                                                                 ║')
      console.error('║  PostgreSQL 11 和 12 不支持自定义扩展                           ║')
      console.error('╠════════════════════════════════════════════════════════════════╣')
      console.error('║  解决方案：                                                     ║')
      console.error('║  在 Render Dashboard 升级数据库到 PostgreSQL 16                 ║')
      console.error('║  Settings → PostgreSQL Version → 16                             ║')
      console.error('╚════════════════════════════════════════════════════════════════╝')
      console.error('')
      throw new Error(`PostgreSQL ${majorVersion} does not support custom extensions (requires 13+)`)
    }

    // Check available extensions
    console.log('[Migrate] Checking pgvector availability...')
    const availableExts = await migrationClient`
      SELECT name, default_version, installed_version 
      FROM pg_available_extensions
      WHERE name = 'vector'
    `
    console.log('[Migrate] pgvector in pg_available_extensions:', JSON.stringify(availableExts))
    
    if (availableExts.length === 0) {
      console.error('')
      console.error('╔════════════════════════════════════════════════════════════════╗')
      console.error('║  ❌ pgvector 扩展不可用                                         ║')
      console.error('╠════════════════════════════════════════════════════════════════╣')
      console.error('║  PostgreSQL 服务器未安装 pgvector 扩展                          ║')
      console.error('║                                                                 ║')
      console.error('║  Render 免费版：                                                ║')
      console.error('║  • 不支持安装扩展                                               ║')
      console.error('║  • 需要升级到 Starter ($7/月)                                   ║')
      console.error('╠════════════════════════════════════════════════════════════════╣')
      console.error('║  推荐免费替代方案：                                             ║')
      console.error('║                                                                 ║')
      console.error('║  1. Supabase - https://supabase.com                             ║')
      console.error('║     • 免费 500MB，自带 pgvector 0.7+                            ║')
      console.error('║                                                                 ║')
      console.error('║  2. Neon - https://neon.tech                                    ║')
      console.error('║     • 免费 3GB，支持 pgvector                                   ║')
      console.error('╚════════════════════════════════════════════════════════════════╝')
      console.error('')
      throw new Error('pgvector extension not available on this PostgreSQL server')
    }

    // Check installed extensions
    const installedExts = await migrationClient`
      SELECT extname, extversion FROM pg_extension
    `
    console.log('[Migrate] Currently installed extensions:', installedExts.map(e => `${e.extname}@${e.extversion}`).join(', '))

    // Enable pgvector extension first (if not exists)
    console.log('[Migrate] Attempting to install pgvector extension...')
    
    // Try to install pgvector
    try {
      await migrationClient`CREATE EXTENSION IF NOT EXISTS vector`
      console.log('[Migrate] CREATE EXTENSION command executed')
    } catch (createError: any) {
      console.error('[Migrate] CREATE EXTENSION failed:', createError.message)
      console.error('[Migrate] Error code:', createError.code)
      
      if (createError.code === '42501') {
        // Permission denied
        console.error('')
        console.error('╔════════════════════════════════════════════════════════════════╗')
        console.error('║  ❌ 权限不足，无法安装扩展                                      ║')
        console.error('╠════════════════════════════════════════════════════════════════╣')
        console.error('║  当前数据库用户没有 SUPERUSER 权限                              ║')
        console.error('║                                                                 ║')
        console.error('║  Render 免费版不允许安装扩展                                    ║')
        console.error('║  需要升级到 Starter 计划 ($7/月)                                ║')
        console.error('╚════════════════════════════════════════════════════════════════╝')
        console.error('')
      }
      
      throw createError
    }

    // Check if pgvector is actually installed
    const extResult = await migrationClient`
      SELECT extversion FROM pg_extension WHERE extname = 'vector'
    `
    
    if (extResult.length === 0) {
      // pgvector not installed - show error and exit
      console.error('')
      console.error('╔════════════════════════════════════════════════════════════════╗')
      console.error('║  ❌ pgvector 扩展未安装                                         ║')
      console.error('╠════════════════════════════════════════════════════════════════╣')
      console.error('║  CREATE EXTENSION 命令执行了，但扩展未生效                       ║')
      console.error('╠════════════════════════════════════════════════════════════════╣')
      console.error('║  手动安装步骤：                                                 ║')
      console.error('║                                                                 ║')
      console.error('║  1. Render Dashboard → nexusnote-db → Connect                   ║')
      console.error('║  2. 复制 "PSQL Command"                                         ║')
      console.error('║  3. 在本地终端执行连接命令                                      ║')
      console.error('║  4. 执行: CREATE EXTENSION IF NOT EXISTS vector;                ║')
      console.error('║  5. 验证: SELECT extversion FROM pg_extension                   ║')
      console.error('║           WHERE extname=\'vector\';                              ║')
      console.error('║                                                                 ║')
      console.error('║  如果仍然失败，联系 Render 支持:                                ║')
      console.error('║  support@render.com                                             ║')
      console.error('╚════════════════════════════════════════════════════════════════╝')
      console.error('')
      throw new Error('pgvector extension is required but not installed')
    }

    const pgvectorVersion = extResult[0]?.extversion || 'unknown'
    console.log('[Migrate] ✓ pgvector extension found (version:', pgvectorVersion + ')')

    // halfvec requires pgvector 0.5.0+
    if (pgvectorVersion < '0.5.0') {
      console.error('')
      console.error('╔════════════════════════════════════════════════════════════════╗')
      console.error('║  ❌ pgvector 版本过低                                           ║')
      console.error('╠════════════════════════════════════════════════════════════════╣')
      console.error(`║  当前版本: ${pgvectorVersion}                                   ║`)
      console.error('║  需要版本: 0.5.0+                                               ║')
      console.error('║                                                                 ║')
      console.error('║  halfvec 类型需要 pgvector 0.5.0 或更高版本                     ║')
      console.error('╠════════════════════════════════════════════════════════════════╣')
      console.error('║  解决方案：升级 pgvector 或使用新数据库                         ║')
      console.error('╚════════════════════════════════════════════════════════════════╝')
      console.error('')
      throw new Error(`pgvector ${pgvectorVersion} does not support halfvec (requires 0.5.0+)`)
    }

    console.log('[Migrate] ✓ pgvector version check passed')

    // Run drizzle migrations
    console.log('[Migrate] Running schema migrations...')
    await migrate(db, { migrationsFolder: './drizzle' })
    console.log('[Migrate] ✓ All migrations applied successfully')

  } catch (error) {
    console.error('[Migrate] ❌ Migration failed:', error)
    throw error
  } finally {
    await migrationClient.end()
  }
}

runMigrations()
  .then(() => {
    console.log('[Migrate] Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('[Migrate] Fatal error:', error)
    process.exit(1)
  })
