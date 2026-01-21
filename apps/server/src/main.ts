import 'dotenv/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { startHocuspocus } from './collaboration/hocuspocus'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // CORS 配置
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })

  // 启动 NestJS API 服务
  const port = process.env.PORT || 3001
  await app.listen(port)
  console.log(`NestJS API server running on http://localhost:${port}`)

  // 启动 Hocuspocus 协同服务（独立端口）
  startHocuspocus()
}

bootstrap()
