import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { AuthType } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getConfig } from '../config/env';
import { AccessTokenPayload } from './token.service';

export interface JwtUser {
  id: string;
  address: string | null;
  email: string | null;
  role: string;
  authType: AuthType;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getConfig().jwtSecret,
    });
  }

  validate(payload: AccessTokenPayload): JwtUser {
    return {
      id: payload.sub,
      address: payload.address ?? null,
      email: payload.email ?? null,
      role: payload.role,
      authType: payload.authType,
    };
  }
}
