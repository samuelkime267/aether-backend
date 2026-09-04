import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Patch,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { JwtUser } from './jwt.strategy';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthContext, AuthService } from './auth.service';
import { CookieService } from './cookie.service';
import { GoogleService } from './google.service';
import {
  AuthResultDto,
  LogoutResponseDto,
  MeResponseDto,
  NonceResponseDto,
  SettingsResponseDto,
  UserResponseDto,
} from './dto/auth-responses.dto';
import { GoogleTokenDto } from './dto/google-token.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestNonceDto } from './dto/request-nonce.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { VerifyWalletDto } from './dto/verify-wallet.dto';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { getConfig } from '../config/env';

@Controller('auth')
@UseGuards(ThrottlerGuard)
@ApiTags('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookieService: CookieService,
    private readonly googleService: GoogleService,
  ) {}

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('nonce')
  @ApiOperation({
    summary: 'Request a SIWE nonce',
    description:
      'Generates a nonce and the SIWE message the wallet must sign for a given address/origin.',
  })
  @ApiResponse({
    status: 201,
    description: 'Nonce + SIWE message ready to sign',
    type: NonceResponseDto,
  })
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
  @ApiOperation({
    summary: 'Verify wallet signature and sign in',
    description:
      'Verifies the SIWE signature for the address/nonce, creates or logs in the user, and returns an access token. Sets a refresh cookie.',
  })
  @ApiResponse({
    status: 201,
    description: 'Authenticated successfully',
    type: AuthResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid signature, unknown nonce, or expired nonce',
  })
  @ApiResponse({ status: 409, description: 'Email already in use' })
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
  @ApiOperation({
    summary: 'Register with email/password',
    description:
      'Creates a new credentials account, optionally with profile fields. Returns an access token and sets a refresh cookie.',
  })
  @ApiResponse({
    status: 201,
    description: 'Account created',
    type: AuthResultDto,
  })
  @ApiResponse({ status: 409, description: 'Email already registered' })
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
  @ApiOperation({
    summary: 'Log in with email/password',
    description: 'Authenticates with email + password and sets a refresh cookie.',
  })
  @ApiResponse({
    status: 200,
    description: 'Logged in',
    type: AuthResultDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
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
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Uses the rotating refresh cookie to issue a new access token. Optionally re-links a wallet address for WALLET sessions.',
  })
  @ApiResponse({
    status: 200,
    description: 'New access token issued',
    type: AuthResultDto,
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid refresh token' })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const token = this.cookieService.getRefreshToken(req);
    if (!token) {
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
  @ApiOperation({ summary: 'Log out', description: 'Revokes the refresh token and clears the cookie.' })
  @ApiResponse({
    status: 200,
    description: 'Logged out',
    type: LogoutResponseDto,
  })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(this.cookieService.getRefreshToken(req));
    this.cookieService.clearRefreshCookie(res);
    return { message: 'Logged out' };
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Get('google/login')
  @ApiOperation({
    summary: 'Start Google sign-in (redirects to Google)',
    description:
      'Redirects the browser to Google OAuth. On success Google redirects back to GET /auth/google/callback. All credentials stay on the backend.',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to Google\u2019s OAuth consent screen',
  })
  @ApiResponse({
    status: 503,
    description: 'Google OAuth not configured (GOOGLE_CLIENT_ID/SECRET missing)',
  })
  googleLogin(@Req() req: Request, @Res() res: Response) {
    if (!getConfig().googleClientId) {
      throw new ServiceUnavailableException('Google OAuth is not configured');
    }
    const redirectUri = this.buildCallbackUri(req);
    const state = this.googleService.signState();
    const url = this.googleService.buildAuthorizationUrl(redirectUri, state);
    res.redirect(HttpStatus.FOUND, url);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Get('google/callback')
  @ApiOperation({
    summary: 'Google OAuth callback',
    description:
      'Receives the authorization code and state from Google, exchanges the code + client secret for tokens, verifies the user exists, signs a short-lived (120s) login ticket, and redirects the browser to the frontend with ?ticket=... so credentials are never in the URL.',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to FE_URL/auth/callback?ticket=<signed-login-ticket>',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid state or Google token verification failed',
  })
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Ip() ip: string,
  ) {
    const feUrl = getConfig().feUrl;
    const failUrl = `${feUrl}/?error=google`;

    try {
      const { code, state } = req.query as { code?: string; state?: string };
      if (!state || !this.googleService.verifyState(state)) {
        throw new UnauthorizedException('Invalid OAuth state');
      }
      if (!code) {
        throw new UnauthorizedException('Missing authorization code');
      }

      const redirectUri = this.buildCallbackUri(req);
      const tokens = await this.googleService.exchangeCodeForTokens(
        code,
        redirectUri,
      );
      const user = await this.authService.findOrCreateGoogleUser(
        tokens.id_token,
      );

      const ticket = this.googleService.signLoginTicket(user.id);
      const successUrl = new URL('/auth/callback', feUrl);
      successUrl.searchParams.set('ticket', ticket);
      return res.redirect(HttpStatus.FOUND, successUrl.toString());
    } catch (error) {
      if (res.headersSent) {
        throw error;
      }
      return res.redirect(HttpStatus.FOUND, failUrl);
    }
  }

  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('google/token')
  @ApiOperation({
    summary: 'Exchange Google login ticket for an access token',
    description:
      'Verifies the short-lived signed login ticket sent by the frontend (from ?ticket=...), creates a session for that user, sets the HttpOnly refresh cookie, and returns an access token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Access token issued; refresh cookie set',
    type: AuthResultDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Ticket invalid, expired, or signed with the wrong secret',
  })
  async googleToken(
    @Body() dto: GoogleTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const { sub: userId } = this.googleService.verifyLoginTicket(dto.ticket);
    const { refreshToken, ...result } = await this.authService.googleSignIn(
      userId,
      this.resolveContext(req, ip),
    );
    this.cookieService.setRefreshCookie(res, refreshToken);
    return result;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  @ApiOperation({
    summary: 'Update own profile',
    description: 'Updates the authenticated user\u2019s username / first / last name.',
  })
  @ApiResponse({
    status: 200,
    description: 'Updated profile',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 409, description: 'Username already taken' })
  updateMe(@CurrentUser() user: JwtUser, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('me/settings')
  @ApiOperation({
    summary: 'Update own preferences',
    description:
      'Updates the authenticated user\u2019s preferences (model, history, sidebar).',
  })
  @ApiResponse({
    status: 200,
    description: 'Updated settings',
    type: SettingsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  updateMySettings(@CurrentUser() user: JwtUser, @Body() dto: UpdateSettingsDto) {
    return this.authService.updateSettings(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({
    summary: 'Get current user',
    description: 'Returns the authenticated user, auth type, and preferences.',
  })
  @ApiResponse({
    status: 200,
    description: 'Current user',
    type: MeResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
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

  private buildCallbackUri(req: Request): string {
    const host = req.headers.host;
    const protocol = req.protocol || 'http';
    const base = host ? `${protocol}://${host}` : getConfig().feUrl;
    return `${base}/auth/google/callback`;
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
