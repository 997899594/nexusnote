import 'dotenv/config'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'
import { startHocuspocus } from './collaboration/hocuspocus'
import { env, logEnvConfig } from './config/env.config'

async function bootstrap() {
  // 启动时打印已验证的配置
  logEnvConfig()

  const app = await NestFactory.create(AppModule)

  // 全局验证管道 - 自动验证所有 DTO
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,        // 自动剥离未定义的属性
    forbidNonWhitelisted: true, // 未定义属性时抛错
    transform: true,        // 自动转换类型
  }))

  // CORS 配置
  app.enableCors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })

  // 启动 NestJS API 服务
  await app.listen(env.PORT)
  console.log(`NestJS API server running on http://localhost:${env.PORT}`)

  // 启动 Hocuspocus 协同服务（独立端口）
  startHocuspocus()
}

bootstrap()
