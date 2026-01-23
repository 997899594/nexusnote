import { Injectable } from '@nestjs/common'
import * as jwt from 'jsonwebtoken'
import { env } from '../config/env.config'

/**
 * JWT Payload structure
 */
export interface JWTPayload {
  sub: string        // User ID
  name: string       // Display name
  email?: string     // Email (optional)
  iat?: number       // Issued at
  exp?: number       // Expires at
}

/**
 * Authenticated user info
 */
export interface AuthenticatedUser {
  id: string
  name: string
  email?: string
  color: string      // For collaboration cursor
}

/**
 * Authentication Service
 *
 * Handles JWT token generation and verification.
 * In production, integrate with your auth provider (Auth0, Clerk, etc.)
 */
@Injectable()
export class AuthService {
  private readonly jwtSecret = env.JWT_SECRET
  private readonly jwtExpiresIn = env.JWT_EXPIRES_IN
  private readonly jwtIssuer = env.JWT_ISSUER

  /**
   * Generate a JWT token for a user
   */
  generateToken(user: { id: string; name: string; email?: string }): string {
    const payload: JWTPayload = {
      sub: user.id,
      name: user.name,
      email: user.email,
    }

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn as jwt.SignOptions['expiresIn'],
      issuer: this.jwtIssuer,
    })
  }

  /**
   * Verify a JWT token and return the payload
   */
  verifyToken(token: string): JWTPayload | null {
    try {
      const payload = jwt.verify(token, this.jwtSecret, {
        issuer: this.jwtIssuer,
      }) as JWTPayload

      return payload
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        console.warn('[Auth] Token expired')
      } else if (error instanceof jwt.JsonWebTokenError) {
        console.warn('[Auth] Invalid token:', error.message)
      }
      return null
    }
  }

  /**
   * Extract user info from a verified token
   */
  getUserFromToken(token: string): AuthenticatedUser | null {
    const payload = this.verifyToken(token)
    if (!payload) return null

    return {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      color: this.generateUserColor(payload.sub),
    }
  }

  /**
   * Generate a consistent color for a user based on their ID
   */
  private generateUserColor(userId: string): string {
    // Simple hash-based color generation for consistency
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash)
    }

    const hue = Math.abs(hash % 360)
    return `hsl(${hue}, 70%, 50%)`
  }

  /**
   * Create a development token for testing
   * WARNING: Only use in development!
   */
  createDevToken(name: string = 'Dev User'): string {
    if (env.NODE_ENV === 'production') {
      throw new Error('Dev tokens not allowed in production')
    }

    return this.generateToken({
      id: `dev-${Date.now()}`,
      name,
      email: 'dev@nexusnote.local',
    })
  }
}
