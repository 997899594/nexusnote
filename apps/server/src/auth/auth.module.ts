import { Module, Global } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { env, defaults } from "@nexusnote/config";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";

/**
 * Auth Module
 *
 * Global module providing authentication services across the application.
 */
@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: env.JWT_SECRET,
      signOptions: { expiresIn: defaults.jwt.expiresIn },
    }),
  ],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
