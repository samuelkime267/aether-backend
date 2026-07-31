import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthType, Role } from '@prisma/client';
import { createHash } from 'node:crypto';
import { getConfig } from '../config/env';

export interface AccessTokenPayload {
  sub: string;
  address: string | null;
  email: string | null;
  role: Role;
  authType: AuthType;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  type: 'refresh';
}

export interface TokenUser {
  id: string;
  address: string | null;
  email: string | null;
  role: Role;
}

@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  signAccessToken(user: TokenUser, authType: AuthType): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      address: user.address,
      email: user.email,
      role: user.role,
      authType,
      type: 'access',
    };
    return this.jwtService.signAsync(payload, {
      expiresIn: getConfig().accessTokenTtl,
    });
  }

  signRefreshToken(userId: string, sessionId: string): Promise<string> {
    const payload: RefreshTokenPayload = {
      sub: userId,
      sid: sessionId,
      type: 'refresh',
    };
    return this.jwtService.signAsync(payload, {
      expiresIn: getConfig().refreshTokenTtl,
    });
  }

  verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    return this.jwtService.verifyAsync<RefreshTokenPayload>(token);
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
