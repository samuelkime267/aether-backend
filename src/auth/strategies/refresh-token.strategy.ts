import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { getConfig } from '../../config/env';
import { CookieService } from '../cookie.service';
import { RefreshTokenPayload } from '../token.service';

export interface RefreshTokenUser {
  sub: string;
  sid: string;
}

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'refresh',
) {
  constructor(private readonly cookieService: CookieService) {
    super({
      jwtFromRequest: (req: Request) =>
        this.cookieService.getRefreshToken(req) ?? null,
      ignoreExpiration: false,
      secretOrKey: getConfig().jwtSecret,
    });
  }

  validate(payload: RefreshTokenPayload): RefreshTokenUser | null {
    if (payload.type !== 'refresh') {
      return null;
    }
    return { sub: payload.sub, sid: payload.sid };
  }
}
