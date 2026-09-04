import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { GoogleService } from './google.service';
import { SiweService } from './siwe.service';
import { TokenService } from './token.service';

const now = new Date();

function objectContaining<T extends object>(expected: T): T {
  return expect.objectContaining(expected) as T;
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'hashed-password',
    googleId: null,
    address: null,
    username: 'alice',
    firstName: null,
    lastName: null,
    role: 'USER',
    tier: 'FREE',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeChallenge(overrides: Record<string, unknown> = {}) {
  return {
    id: 'challenge-1',
    nonce: 'nonce-1',
    address: '0x1234',
    message: 'siwe-message',
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    createdAt: now,
    ...overrides,
  };
}

function makeActiveSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    userId: 'user-1',
    refreshTokenHash: 'hashed-refresh-token',
    authType: 'CREDENTIALS',
    userAgent: null,
    ip: null,
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    lastUsedAt: now,
    createdAt: now,
    ...overrides,
  };
}

function makeTxMock() {
  return {
    nonce: { update: jest.fn().mockResolvedValue({}) },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

function makePrismaMock(tx: ReturnType<typeof makeTxMock>) {
  return {
    nonce: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    session: {
      create: jest.fn().mockResolvedValue({ id: 'session-1' }),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    userSettings: {
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({
        id: 'settings-1',
        userId: 'user-1',
        selectedModel: 'aether-crypto-v1',
        saveHistory: true,
        compactSidebar: false,
        createdAt: now,
        updatedAt: now,
      }),
      update: jest.fn().mockImplementation(({ data }) => ({
        id: 'settings-1',
        userId: 'user-1',
        selectedModel: 'aether-crypto-v1',
        saveHistory: true,
        compactSidebar: false,
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
    },
    $transaction: jest.fn((cb: (client: unknown) => unknown) => cb(tx)),
  };
}

function makeTokenServiceMock() {
  return {
    signAccessToken: jest.fn().mockResolvedValue('access-token'),
    signRefreshToken: jest.fn().mockResolvedValue('refresh-token'),
    verifyRefreshToken: jest.fn(),
    hashRefreshToken: jest.fn().mockReturnValue('hashed-refresh-token'),
  };
}

function makeSiweServiceMock() {
  return {
    checksum: jest.fn((a: string) => a),
    generateNonce: jest.fn().mockReturnValue('nonce-1'),
    buildMessage: jest.fn().mockReturnValue('siwe-message'),
    verifyMessage: jest.fn().mockResolvedValue(true),
  };
}

function makeGoogleServiceMock() {
  return {
    verifyIdToken: jest.fn(),
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let tx: ReturnType<typeof makeTxMock>;
  let prisma: ReturnType<typeof makePrismaMock>;
  let tokenService: ReturnType<typeof makeTokenServiceMock>;
  let siweService: ReturnType<typeof makeSiweServiceMock>;
  let googleService: ReturnType<typeof makeGoogleServiceMock>;
  const ctx = { userAgent: 'test-agent', ip: '127.0.0.1' };

  beforeEach(() => {
    tx = makeTxMock();
    prisma = makePrismaMock(tx);
    tokenService = makeTokenServiceMock();
    siweService = makeSiweServiceMock();
    googleService = makeGoogleServiceMock();

    service = new AuthService(
      prisma as unknown as PrismaService,
      tokenService as unknown as TokenService,
      siweService as unknown as SiweService,
      googleService as unknown as GoogleService,
    );
  });

  describe('requestNonce', () => {
    it('persists a challenge and returns nonce + message', async () => {
      const result = await service.requestNonce({
        address: '0x1234',
        domain: 'localhost',
        uri: 'http://localhost:3000',
      });

      expect(result.nonce).toBe('nonce-1');
      expect(result.message).toBe('siwe-message');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(prisma.nonce.create).toHaveBeenCalledWith({
        data: objectContaining({
          nonce: 'nonce-1',
          message: 'siwe-message',
        }),
      });
    });
  });

  describe('verifyWallet', () => {
    beforeEach(() => {
      prisma.nonce.findUnique.mockResolvedValue(makeChallenge());
    });

    it('creates a user on first sign-in and issues tokens', async () => {
      tx.user.findUnique.mockResolvedValue(null);
      tx.user.create.mockResolvedValue(makeUser({ address: '0x1234' }));

      const result = await service.verifyWallet(
        { address: '0x1234', nonce: 'nonce-1', signature: '0xdeadbeef' },
        ctx,
      );

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.authType).toBe('WALLET');
      expect(result.user.address).toBe('0x1234');
      expect(tx.nonce.update).toHaveBeenCalledWith({
        where: { id: 'challenge-1' },
        data: { usedAt: expect.any(Date) as Date },
      });
      expect(tx.user.create).toHaveBeenCalled();
      expect(prisma.session.create).toHaveBeenCalledWith({
        data: objectContaining({
          userId: 'user-1',
          authType: 'WALLET',
          userAgent: 'test-agent',
          ip: '127.0.0.1',
        }),
      });
    });

    it('rejects an unknown nonce', async () => {
      prisma.nonce.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyWallet(
          { address: '0x1234', nonce: 'nope', signature: '0xdeadbeef' },
          ctx,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a nonce that was already used', async () => {
      prisma.nonce.findUnique.mockResolvedValue(makeChallenge({ usedAt: now }));

      await expect(
        service.verifyWallet(
          { address: '0x1234', nonce: 'nonce-1', signature: '0xdeadbeef' },
          ctx,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an invalid signature', async () => {
      siweService.verifyMessage.mockResolvedValue(false);

      await expect(
        service.verifyWallet(
          { address: '0x1234', nonce: 'nonce-1', signature: '0xdeadbeef' },
          ctx,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('merges a new email onto an existing wallet user', async () => {
      tx.user.findUnique.mockImplementation(
        (args: { where: { address?: string; email?: string } }) => {
          if (args.where.address) {
            return makeUser({ address: '0x1234', email: null });
          }
          return null;
        },
      );
      tx.user.update.mockResolvedValue(
        makeUser({ address: '0x1234', email: 'new@example.com' }),
      );

      const result = await service.verifyWallet(
        {
          address: '0x1234',
          nonce: 'nonce-1',
          signature: '0xdeadbeef',
          email: 'new@example.com',
        },
        ctx,
      );

      expect(result.user.email).toBe('new@example.com');
      expect(tx.user.update).toHaveBeenCalled();
    });

    it('rejects an email already claimed by another user', async () => {
      tx.user.findUnique.mockImplementation(
        (args: { where: { address?: string; email?: string } }) => {
          if (args.where.address) {
            return makeUser({ address: '0x1234', email: null });
          }
          return makeUser({ address: '0xaaaa', email: 'taken@example.com' });
        },
      );

      await expect(
        service.verifyWallet(
          {
            address: '0x1234',
            nonce: 'nonce-1',
            signature: '0xdeadbeef',
            email: 'taken@example.com',
          },
          ctx,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('register', () => {
    it('hashes the password and creates the user', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(makeUser());

      const result = await service.register(
        {
          email: 'user@example.com',
          password: 'password123',
          username: 'alice',
        },
        ctx,
      );

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: objectContaining({
          email: 'user@example.com',
          username: 'alice',
          passwordHash: expect.any(String) as string,
        }),
      });
      const createMock = prisma.user.create as jest.Mock<
        Promise<User>,
        [{ data: { passwordHash: string } }]
      >;
      const data = createMock.mock.calls[0][0].data;
      expect(await bcrypt.compare('password123', data.passwordHash)).toBe(true);
      expect(result.user.email).toBe('user@example.com');
      expect(result.authType).toBe('CREDENTIALS');
    });

    it('throws ConflictException when the email is taken', async () => {
      prisma.user.findFirst.mockResolvedValue(makeUser());

      await expect(
        service.register(
          { email: 'user@example.com', password: 'password123' },
          ctx,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException on a unique-constraint race', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(
        Object.assign(new Error('unique violation'), { code: 'P2002' }),
      );

      await expect(
        service.register(
          { email: 'user@example.com', password: 'password123' },
          ctx,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('issues tokens for valid credentials', async () => {
      const passwordHash = await bcrypt.hash('password123', 4);
      prisma.user.findUnique.mockResolvedValue(makeUser({ passwordHash }));

      const result = await service.login(
        { email: 'user@example.com', password: 'password123' },
        ctx,
      );

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.authType).toBe('CREDENTIALS');
      expect(prisma.session.create).toHaveBeenCalled();
    });

    it('throws UnauthorizedException for a wrong password', async () => {
      const passwordHash = await bcrypt.hash('password123', 4);
      prisma.user.findUnique.mockResolvedValue(makeUser({ passwordHash }));

      await expect(
        service.login(
          { email: 'user@example.com', password: 'wrong-password' },
          ctx,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when the user has no password', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ passwordHash: null }),
      );

      await expect(
        service.login(
          { email: 'user@example.com', password: 'password123' },
          ctx,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    const payload = {
      sub: 'user-1',
      sid: 'session-1',
      type: 'refresh' as const,
    };

    beforeEach(() => {
      tokenService.verifyRefreshToken.mockResolvedValue(payload);
      prisma.session.findUnique.mockResolvedValue(makeActiveSession());
      prisma.user.findUnique.mockResolvedValue(makeUser());
    });

    it('rotates the refresh token and returns a new access token', async () => {
      const result = await service.refresh('refresh-token', ctx);

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.authType).toBe('CREDENTIALS');
      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: objectContaining({
          refreshTokenHash: 'hashed-refresh-token',
          lastUsedAt: expect.any(Date) as Date,
          userAgent: 'test-agent',
          ip: '127.0.0.1',
        }),
      });
    });

    it('rejects a revoked session', async () => {
      prisma.session.findUnique.mockResolvedValue(
        makeActiveSession({ revokedAt: now }),
      );

      await expect(
        service.refresh('refresh-token', ctx),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a missing session', async () => {
      prisma.session.findUnique.mockResolvedValue(null);

      await expect(
        service.refresh('refresh-token', ctx),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a token hash mismatch', async () => {
      prisma.session.findUnique.mockResolvedValue(
        makeActiveSession({ refreshTokenHash: 'some-other-hash' }),
      );

      await expect(
        service.refresh('refresh-token', ctx),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('accepts a matching wallet address on a WALLET session', async () => {
      prisma.session.findUnique.mockResolvedValue(
        makeActiveSession({ authType: 'WALLET' }),
      );
      prisma.user.findUnique.mockResolvedValue(makeUser({ address: '0x1234' }));

      const result = await service.refresh('refresh-token', ctx, '0x1234');

      expect(result.authType).toBe('WALLET');
      expect(tokenService.signAccessToken).toHaveBeenCalledWith(
        expect.any(Object) as User,
        'WALLET',
      );
    });

    it('rejects an address that does not match the session wallet', async () => {
      prisma.session.findUnique.mockResolvedValue(
        makeActiveSession({ authType: 'WALLET' }),
      );
      prisma.user.findUnique.mockResolvedValue(makeUser({ address: '0x1234' }));

      await expect(
        service.refresh('refresh-token', ctx, '0xaaaa'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an address on a CREDENTIALS session', async () => {
      await expect(
        service.refresh('refresh-token', ctx, '0x1234'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes the session', async () => {
      tokenService.verifyRefreshToken.mockResolvedValue({
        sub: 'user-1',
        sid: 'session-1',
        type: 'refresh',
      });

      await service.logout('refresh-token');

      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { id: 'session-1', userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) as Date },
      });
    });

    it('is a no-op for an invalid token', async () => {
      tokenService.verifyRefreshToken.mockRejectedValue(new Error('bad token'));

      await expect(service.logout('refresh-token')).resolves.toBeUndefined();
      expect(prisma.session.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('me', () => {
    it('returns the safe user and auth type', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());

      const result = await service.me('user-1', 'WALLET');

      expect(result).toEqual({
        user: {
          id: 'user-1',
          address: null,
          walletAddress: null,
          email: 'user@example.com',
          name: 'alice',
          username: 'alice',
          firstName: null,
          lastName: null,
          role: 'USER',
          tier: 'FREE',
          authType: 'WALLET',
          googleId: null,
          createdAt: now,
        },
        authType: 'WALLET',
        settings: {
          selectedModel: 'aether-crypto-v1',
          saveHistory: true,
          compactSidebar: false,
        },
      });
    });

    it('throws UnauthorizedException when the user is gone', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.me('user-1', 'WALLET')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
