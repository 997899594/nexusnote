import { Controller, Get, HttpStatus, Res } from '@nestjs/common'
import { Response } from 'express'
import { HealthService } from './health.service'

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * 基础健康检查 - 返回进程状态
   * Render 使用此端点判断服务是否存活
   */
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    }
  }

  /**
   * 就绪检查 - 验证数据库和 Redis 连接
   * 返回 503 如果任何依赖不可用
   */
  @Get('ready')
  async ready(@Res() res: Response) {
    const status = await this.healthService.getFullStatus()
    const httpStatus = status.status === 'healthy'
      ? HttpStatus.OK
      : HttpStatus.SERVICE_UNAVAILABLE

    return res.status(httpStatus).json(status)
  }

  /**
   * 存活检查 - 简单进程存活检测
   */
  @Get('live')
  live() {
    return { status: 'live' }
  }
}
