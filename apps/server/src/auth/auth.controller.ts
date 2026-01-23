import { Controller, Post, Body, Get, Headers, UnauthorizedException } from '@nestjs/common'
import { AuthService } from './auth.service'
import { env } from '../config/env.config'

/**
 * Development login DTO
 */
class DevLoginDto {
  name?: string
}

/**
 * Auth Controller
 *
 * Provides endpoints for authentication.
 * In production, replace with proper OAuth/OIDC integration.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Development login endpoint
   * Creates a JWT token for development/testing purposes.
   *
   * POST /auth/dev-login
   * Body: { "name": "Test User" }
   */
  @Post('dev-login')
  devLogin(@Body() body: DevLoginDto) {
    if (env.NODE_ENV === 'production') {
      throw new UnauthorizedException('Dev login not available in production')
    }

    const token = this.authService.createDevToken(body.name)
    const user = this.authService.getUserFromToken(token)

    return {
      token,
      user,
      expiresIn: env.JWT_EXPIRES_IN,
    }
  }

  /**
   * Verify token and get current user
   *
   * GET /auth/me
   * Headers: Authorization: Bearer <token>
   */
  @Get('me')
  getCurrentUser(@Headers('authorization') authHeader: string) {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header')
    }

    const token = authHeader.slice(7)
    const user = this.authService.getUserFromToken(token)

    if (!user) {
      throw new UnauthorizedException('Invalid or expired token')
    }

    return { user }
  }

  /**
   * Refresh token
   *
   * POST /auth/refresh
   * Headers: Authorization: Bearer <token>
   */
  @Post('refresh')
  refreshToken(@Headers('authorization') authHeader: string) {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing authorization header')
    }

    const token = authHeader.slice(7)
    const payload = this.authService.verifyToken(token)

    if (!payload) {
      throw new UnauthorizedException('Invalid or expired token')
    }

    // Generate new token with same user info
    const newToken = this.authService.generateToken({
      id: payload.sub,
      name: payload.name,
      email: payload.email,
    })

    return {
      token: newToken,
      expiresIn: env.JWT_EXPIRES_IN,
    }
  }
}
