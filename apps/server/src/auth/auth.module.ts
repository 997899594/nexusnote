import { Module, Global } from '@nestjs/common'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'

/**
 * Auth Module
 *
 * Global module providing authentication services across the application.
 */
@Global()
@Module({
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
