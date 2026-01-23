import { Injectable } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import IORedis from 'ioredis'
import { db } from '../database/database.module'
import { env } from '../config/env.config'

export interface HealthCheck {
  status: 'healthy' | 'unhealthy'
  latencyMs?: number
  error?: string
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  uptime: number
  checks: {
    database: HealthCheck
    redis: HealthCheck
  }
}

@Injectable()
export class HealthService {
  private redisClient: IORedis | null = null

  constructor() {
    // 创建 Redis 客户端用于健康检查
    try {
      this.redisClient = new IORedis(env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        lazyConnect: true,
      })
    } catch {
      this.redisClient = null
    }
  }

  async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now()
    try {
      await db.execute(sql`SELECT 1`)
      return {
        status: 'healthy',
        latencyMs: Date.now() - start,
      }
    } catch (err) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'Database connection failed',
      }
    }
  }

  async checkRedis(): Promise<HealthCheck> {
    if (!this.redisClient) {
      return { status: 'unhealthy', error: 'Redis client not initialized' }
    }

    const start = Date.now()
    try {
      await this.redisClient.ping()
      return {
        status: 'healthy',
        latencyMs: Date.now() - start,
      }
    } catch (err) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'Redis connection failed',
      }
    }
  }

  async getFullStatus(): Promise<HealthStatus> {
    const [dbCheck, redisCheck] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ])

    const allHealthy = dbCheck.status === 'healthy' && redisCheck.status === 'healthy'

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: dbCheck,
        redis: redisCheck,
      },
    }
  }
}
