import { Controller, Get } from '@nestjs/common'

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    }
  }

  @Get('ready')
  ready() {
    // TODO: Check database and Redis connections
    return {
      status: 'ready',
      checks: {
        database: 'ok',
        redis: 'ok',
        hocuspocus: 'ok',
      },
    }
  }

  @Get('live')
  live() {
    return { status: 'live' }
  }
}
