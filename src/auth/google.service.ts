import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createHmac,
  createPublicKey,
  randomBytes,
  timingSafeEqual,
  verify,
} from 'node:crypto';
import { getConfig } from '../config/env';

export interface GoogleIdTokenPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  aud?: string;
  exp?: number;
  iat?: number;
  iss?: string;
}

interface GoogleCert {
  kid?: string;
  n?: string;
  e?: string;
  alg?: string;
}

interface JwtHeader {
  alg?: string;
  kid?: string;
}

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

@Injectable()
export class GoogleService {
  private certs: GoogleCert[] | null = null;
  private certsFetchedAt = 0;
  private readonly certsCacheTtlMs = 60 * 60 * 1000;

  buildAuthorizationUrl(
    redirectUri: string,
    state: string,
  ): string {
    const config = getConfig();
    if (!config.googleClientId) {
      throw new ServiceUnavailableException('Google OAuth is not configured');
    }
    const params = new URLSearchParams({
      client_id: config.googleClientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'consent',
      access_type: 'online',
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  signState(): string {
    const value = randomBytes(32).toString('base64url');
    const hmac = createHmac('sha256', getConfig().jwtSecret)
      .update(value)
      .digest('base64url');
    return `${value}.${hmac}`;
  }

  verifyState(state: string): boolean {
    const [value, hmac] = state.split('.');
    if (!value || !hmac) {
      return false;
    }
    const expected = createHmac('sha256', getConfig().jwtSecret)
      .update(value)
      .digest('base64url');
    const a = Buffer.from(hmac);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private static readonly LOGIN_TICKET_TTL_MS = 120_000;
  private static readonly LOGIN_TICKET_PURPOSE = 'google-login';

  signLoginTicket(userId: string): string {
    const secret = getConfig().googleTicketSecret;
    if (!secret) {
      throw new ServiceUnavailableException(
        'Google login ticket secret (GOOGLE_TICKET_SECRET) is not configured',
      );
    }
    const now = Date.now();
    const payload = {
      sub: userId,
      purpose: GoogleService.LOGIN_TICKET_PURPOSE,
      iat: now,
      exp: now + GoogleService.LOGIN_TICKET_TTL_MS,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', secret).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  verifyLoginTicket(token: string): { sub: string } {
    const secret = getConfig().googleTicketSecret;
    if (!secret) {
      throw new ServiceUnavailableException(
        'Google login ticket secret (GOOGLE_TICKET_SECRET) is not configured',
      );
    }
    const [body, sig] = token.split('.');
    if (!body || !sig) {
      throw new UnauthorizedException('Invalid login ticket');
    }
    const expected = createHmac('sha256', secret).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid login ticket signature');
    }
    let payload: {
      sub?: string;
      purpose?: string;
      exp?: number;
    };
    try {
      payload = JSON.parse(
        Buffer.from(body, 'base64url').toString('utf8'),
      ) as typeof payload;
    } catch {
      throw new UnauthorizedException('Invalid login ticket');
    }
    if (
      !payload.sub ||
      payload.purpose !== GoogleService.LOGIN_TICKET_PURPOSE ||
      typeof payload.exp !== 'number' ||
      payload.exp < Date.now()
    ) {
      throw new UnauthorizedException('Login ticket expired or invalid');
    }
    return { sub: payload.sub };
  }

  async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
  ): Promise<GoogleTokenResponse> {    const config = getConfig();
    if (!config.googleClientId || !config.googleClientSecret) {
      throw new ServiceUnavailableException('Google OAuth is not configured');
    }
    const body = new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    let res: Response;
    try {
      res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch {
      throw new ServiceUnavailableException('Unable to reach Google token endpoint');
    }
    if (!res.ok) {
      throw new ServiceUnavailableException('Google token exchange failed');
    }
    return (await res.json()) as GoogleTokenResponse;
  }

  async verifyIdToken(idToken: string): Promise<GoogleIdTokenPayload> {
    const clientId = getConfig().googleClientId;
    if (!clientId) {
      throw new ServiceUnavailableException('Google OAuth is not configured');
    }

    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new ServiceUnavailableException('Invalid id_token');
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    let header: JwtHeader;
    let payload: GoogleIdTokenPayload;
    try {
      header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
      payload = JSON.parse(
        Buffer.from(payloadB64, 'base64url').toString('utf8'),
      );
    } catch {
      throw new ServiceUnavailableException('Invalid id_token');
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp !== undefined && payload.exp < now) {
      throw new ServiceUnavailableException('id_token expired');
    }
    if (payload.aud !== clientId) {
      throw new ServiceUnavailableException('id_token audience mismatch');
    }
    if (
      payload.iss &&
      !/^(https:\/\/accounts\.google\.com|accounts\.google\.com)$/.test(
        payload.iss as string,
      )
    ) {
      throw new ServiceUnavailableException('id_token invalid issuer');
    }
    if (header.alg !== 'RS256') {
      throw new ServiceUnavailableException('id_token unsupported algorithm');
    }

    const cert = await this.findCert(header.kid);
    if (!cert?.n || !cert?.e) {
      throw new ServiceUnavailableException('id_token signing key not found');
    }

    try {
      const publicKey = createPublicKey({
        key: { kty: 'RSA', n: cert.n, e: cert.e },
        format: 'jwk',
      });
      const signature = Buffer.from(signatureB64, 'base64url');
      const signedContent = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
      const valid = verify('RSA-SHA256', signedContent, publicKey, signature);
      if (!valid) {
        throw new ServiceUnavailableException('id_token signature invalid');
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException('id_token verification failed');
    }

    return payload;
  }

  private async findCert(kid?: string): Promise<GoogleCert | undefined> {
    await this.ensureCerts();
    let cert = this.getCert(kid);
    if (!cert) {
      // Kid not present in cached certs: force refresh once and retry.
      this.certs = null;
      this.certsFetchedAt = 0;
      await this.ensureCerts();
      cert = this.getCert(kid);
    }
    return cert;
  }

  private getCert(kid?: string): GoogleCert | undefined {
    return this.certs?.find((k) => k.kid === kid);
  }

  private async ensureCerts(): Promise<void> {
    if (
      this.certs &&
      Date.now() - this.certsFetchedAt < this.certsCacheTtlMs
    ) {
      return;
    }
    try {
      const res = await fetch(CERTS_URL);
      if (!res.ok) {
        throw new Error('failed to fetch Google certs');
      }
      const data = (await res.json()) as { keys?: GoogleCert[] };
      this.certs = data.keys ?? [];
      this.certsFetchedAt = Date.now();
    } catch {
      this.certs = null;
      throw new ServiceUnavailableException('Unable to verify id_token');
    }
  }
}
