import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { JwtUser } from './jwt.strategy';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthContext, AuthService } from './auth.service';
import { CookieService } from './cookie.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestNonceDto } from './dto/request-nonce.dto';
import { VerifyWalletDto } from './dto/verify-wallet.dto';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { REFRESH_COOKIE_NAME } from './auth.constants';
import { getConfig } from '../config/env';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookieService: CookieService,
  ) {}

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('nonce')
  requestNonce(@Body() dto: RequestNonceDto, @Req() req: Request) {
    const origin = this.resolveOrigin(req);
    return this.authService.requestNonce({
      address: dto.address,
      domain: this.resolveDomain(origin),
      uri: dto.uri,
    });
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('verify')
  async verifyWallet(
    @Body() dto: VerifyWalletDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const { refreshToken, ...result } = await this.authService.verifyWallet(
      dto,
      this.resolveContext(req, ip),
    );
    this.cookieService.setRefreshCookie(res, refreshToken);
    return result;
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const { refreshToken, ...result } = await this.authService.register(
      dto,
      this.resolveContext(req, ip),
    );
    this.cookieService.setRefreshCookie(res, refreshToken);
    return result;
  }

  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const { refreshToken, ...result } = await this.authService.login(
      dto,
      this.resolveContext(req, ip),
    );
    this.cookieService.setRefreshCookie(res, refreshToken);
    return result;
  }

  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const token: unknown = req.cookies?.[REFRESH_COOKIE_NAME];
    if (typeof token !== 'string') {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const { refreshToken, ...result } = await this.authService.refresh(
      token,
      this.resolveContext(req, ip),
      dto.address,
    );
    this.cookieService.setRefreshCookie(res, refreshToken);
    return result;
  }

  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseGuards(RefreshTokenGuard)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token: unknown = req.cookies?.[REFRESH_COOKIE_NAME];
    await this.authService.logout(
      typeof token === 'string' ? token : undefined,
    );
    this.cookieService.clearRefreshCookie(res);
    return { message: 'Logged out' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request) {
    const user = req.user as JwtUser;
    return this.authService.me(user.id, user.authType);
  }

  private resolveOrigin(req: Request): string {
    const header = req.headers.origin;
    if (typeof header === 'string' && header.length > 0) {
      return header;
    }
    return getConfig().feUrl;
  }

  private resolveDomain(origin: string): string {
    try {
      return new URL(origin).host;
    } catch {
      return 'localhost';
    }
  }

  private resolveContext(req: Request, ip: string): AuthContext {
    const userAgent = req.headers['user-agent'];
    return {
      userAgent: typeof userAgent === 'string' ? userAgent : undefined,
      ip,
    };
  }
}
