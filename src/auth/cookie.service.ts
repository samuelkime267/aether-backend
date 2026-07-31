import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { REFRESH_COOKIE_MAX_AGE, REFRESH_COOKIE_NAME } from './auth.constants';

@Injectable()
export class CookieService {
  private readonly baseOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/auth',
  };

  setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      ...this.baseOptions,
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });
  }

  clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE_NAME, this.baseOptions);
  }
}
