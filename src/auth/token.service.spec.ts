import { JwtService } from '@nestjs/jwt';
import { getConfig } from '../config/env';
import { TokenService } from './token.service';

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: Record<string, jest.Mock>;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
  });

  beforeEach(() => {
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 'user-1',
        sid: 'session-1',
        type: 'refresh',
      }),
    };
    service = new TokenService(jwtService as unknown as JwtService);
  });

  describe('signAccessToken', () => {
    it('signs the access payload with the configured TTL', async () => {
      const token = await service.signAccessToken(
        {
          id: 'user-1',
          address: '0x1234',
          email: 'user@example.com',
          role: 'USER',
        },
        'WALLET',
      );

      expect(token).toBe('signed-token');
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: 'user-1',
          address: '0x1234',
          email: 'user@example.com',
          role: 'USER',
          authType: 'WALLET',
          type: 'access',
        },
        { expiresIn: getConfig().accessTokenTtl },
      );
    });
  });

  describe('signRefreshToken', () => {
    it('signs the refresh payload with the configured TTL', async () => {
      await service.signRefreshToken('user-1', 'session-1');

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: 'user-1', sid: 'session-1', type: 'refresh' },
        { expiresIn: getConfig().refreshTokenTtl },
      );
    });
  });

  describe('verifyRefreshToken', () => {
    it('delegates to JwtService', async () => {
      const payload = await service.verifyRefreshToken('token');

      expect(payload).toEqual({
        sub: 'user-1',
        sid: 'session-1',
        type: 'refresh',
      });
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('token');
    });
  });

  describe('hashRefreshToken', () => {
    it('returns a deterministic 64-char hex digest', () => {
      const hash = service.hashRefreshToken('token-abc');
      const hashAgain = service.hashRefreshToken('token-abc');

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash).toBe(hashAgain);
    });
  });
});
