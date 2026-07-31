import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { getConfig } from '../../config/env';
import { REFRESH_COOKIE_NAME } from '../auth.constants';
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
  constructor() {
    super({
      jwtFromRequest: (req: Request) => {
        const token: unknown = req.cookies?.[REFRESH_COOKIE_NAME];
        return typeof token === 'string' ? token : null;
      },
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
