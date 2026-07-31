import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthType, Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import type { Hex } from 'viem';
import { PrismaService } from '../prisma/prisma.service';
import {
  BCRYPT_ROUNDS,
  NONCE_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
} from './auth.constants';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SiweService } from './siwe.service';
import { TokenService } from './token.service';

export interface SafeUser {
  id: string;
  address: string | null;
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  tier: string;
  createdAt: Date;
}

export interface AuthContext {
  userAgent?: string;
  ip?: string;
}

export interface RequestNonceResult {
  nonce: string;
  message: string;
  expiresAt: Date;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  authType: AuthType;
  user: SafeUser;
}

export interface MeResult {
  user: SafeUser;
  authType: AuthType;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly siweService: SiweService,
  ) {}

  async requestNonce(input: {
    address: string;
    domain: string;
    uri: string;
  }): Promise<RequestNonceResult> {
    const address = this.siweService.checksum(input.address);
    const nonce = this.siweService.generateNonce();
    const expiresAt = new Date(Date.now() + NONCE_TTL_MS);
    const message = this.siweService.buildMessage({
      address,
      domain: input.domain,
      uri: input.uri,
      nonce,
      issuedAt: new Date(),
    });
    await this.prisma.nonce.create({
      data: { nonce, address, message, expiresAt },
    });
    return { nonce, message, expiresAt };
  }

  async verifyWallet(
    input: {
      address: string;
      nonce: string;
      signature: string;
      email?: string;
      username?: string;
      firstName?: string;
      lastName?: string;
    },
    ctx: AuthContext,
  ): Promise<AuthResult> {
    const address = this.siweService.checksum(input.address);
    const challenge = await this.prisma.nonce.findUnique({
      where: { nonce: input.nonce },
    });
    if (
      !challenge ||
      challenge.usedAt !== null ||
      challenge.expiresAt < new Date() ||
      challenge.address !== address
    ) {
      throw new UnauthorizedException('Invalid or expired nonce');
    }

    const valid = await this.siweService.verifyMessage(
      challenge.message,
      address,
      input.signature as Hex,
    );
    if (!valid) {
      throw new UnauthorizedException('Invalid signature');
    }

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.nonce.update({
        where: { id: challenge.id },
        data: { usedAt: new Date() },
      });

      const existing = await tx.user.findUnique({ where: { address } });
      if (existing) {
        return this.mergeProfile(tx, existing, input);
      }
      return tx.user.create({
        data: {
          address,
          email: input.email,
          username: input.username,
          firstName: input.firstName,
          lastName: input.lastName,
        },
      });
    });

    const session = await this.createSession(user.id, ctx, 'WALLET');
    return {
      accessToken: await this.tokenService.signAccessToken(user, 'WALLET'),
      refreshToken: session.refreshToken,
      authType: 'WALLET',
      user: this.toSafeUser(user),
    };
  }

  async register(input: RegisterDto, ctx: AuthContext): Promise<AuthResult> {
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: input.email }, { username: input.username }],
      },
    });
    if (existing) {
      if (existing.email === input.email) {
        throw new ConflictException('Email is already in use');
      }
      throw new ConflictException('Username is already in use');
    }

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          email: input.email,
          passwordHash,
          username: input.username,
          firstName: input.firstName,
          lastName: input.lastName,
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Email or username is already in use');
      }
      throw error;
    }

    const session = await this.createSession(user.id, ctx, 'CREDENTIALS');
    return {
      accessToken: await this.tokenService.signAccessToken(user, 'CREDENTIALS'),
      refreshToken: session.refreshToken,
      authType: 'CREDENTIALS',
      user: this.toSafeUser(user),
    };
  }

  async login(input: LoginDto, ctx: AuthContext): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const session = await this.createSession(user.id, ctx, 'CREDENTIALS');
    return {
      accessToken: await this.tokenService.signAccessToken(user, 'CREDENTIALS'),
      refreshToken: session.refreshToken,
      authType: 'CREDENTIALS',
      user: this.toSafeUser(user),
    };
  }

  async refresh(
    refreshToken: string,
    ctx: AuthContext,
    address?: string,
  ): Promise<AuthResult> {
    const payload = await this.tokenService.verifyRefreshToken(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
    });
    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt < new Date() ||
      session.userId !== payload.sub ||
      session.refreshTokenHash !==
        this.tokenService.hashRefreshToken(refreshToken)
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (address) {
      if (session.authType !== AuthType.WALLET) {
        throw new UnauthorizedException(
          'Wallet verification is not available for this session',
        );
      }
      if (user.address !== this.siweService.checksum(address)) {
        throw new UnauthorizedException(
          'Wallet does not match the active session',
        );
      }
    }

    const newRefreshToken = await this.tokenService.signRefreshToken(
      user.id,
      session.id,
    );
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.tokenService.hashRefreshToken(newRefreshToken),
        lastUsedAt: new Date(),
        userAgent: ctx.userAgent ?? session.userAgent,
        ip: ctx.ip ?? session.ip,
      },
    });

    return {
      accessToken: await this.tokenService.signAccessToken(
        user,
        session.authType,
      ),
      refreshToken: newRefreshToken,
      authType: session.authType,
      user: this.toSafeUser(user),
    };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }
    try {
      const payload = await this.tokenService.verifyRefreshToken(refreshToken);
      await this.prisma.session.updateMany({
        where: { id: payload.sid, userId: payload.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Invalid/expired token: nothing to revoke, cookie is cleared by the caller.
    }
  }

  async me(userId: string, authType: AuthType): Promise<MeResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return { user: this.toSafeUser(user), authType };
  }

  private async createSession(
    userId: string,
    ctx: AuthContext,
    authType: AuthType,
  ): Promise<{ refreshToken: string }> {
    const session = await this.prisma.session.create({
      data: {
        userId,
        authType,
        userAgent: ctx.userAgent ?? null,
        ip: ctx.ip ?? null,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        refreshTokenHash: randomUUID(),
      },
    });
    const refreshToken = await this.tokenService.signRefreshToken(
      userId,
      session.id,
    );
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.tokenService.hashRefreshToken(refreshToken),
      },
    });
    return { refreshToken };
  }

  private async mergeProfile(
    tx: Prisma.TransactionClient,
    existing: User,
    input: {
      email?: string;
      username?: string;
      firstName?: string;
      lastName?: string;
    },
  ): Promise<User> {
    const update: Record<string, unknown> = {};

    if (input.email && existing.email !== input.email) {
      const emailTaken = await tx.user.findUnique({
        where: { email: input.email },
      });
      if (emailTaken) {
        throw new ConflictException('Email is already in use');
      }
      update.email = input.email;
    }
    if (input.username && existing.username !== input.username) {
      const usernameTaken = await tx.user.findUnique({
        where: { username: input.username },
      });
      if (usernameTaken) {
        throw new ConflictException('Username is already in use');
      }
      update.username = input.username;
    }
    if (input.firstName && !existing.firstName) {
      update.firstName = input.firstName;
    }
    if (input.lastName && !existing.lastName) {
      update.lastName = input.lastName;
    }

    if (Object.keys(update).length === 0) {
      return existing;
    }
    return tx.user.update({ where: { id: existing.id }, data: update });
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }

  private toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      address: user.address,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tier: user.tier,
      createdAt: user.createdAt,
    };
  }
}
