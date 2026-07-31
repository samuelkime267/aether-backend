import { privateKeyToAccount } from 'viem/accounts';
import { SiweService } from './siwe.service';

const PRIVATE_KEY = `0x${'11'.repeat(32)}` as const;
const account = privateKeyToAccount(PRIVATE_KEY);

describe('SiweService', () => {
  let service: SiweService;

  beforeEach(() => {
    service = new SiweService();
  });

  describe('generateNonce', () => {
    it('returns a random 64-char hex string', () => {
      const nonce = service.generateNonce();

      expect(nonce).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('checksum', () => {
    it('checksums a mixed-case address', () => {
      const mixed = account.address.toLowerCase();

      expect(service.checksum(mixed)).toBe(account.address);
    });
  });

  describe('buildMessage', () => {
    it('builds an EIP-4361 message with the expected fields', () => {
      const message = service.buildMessage({
        address: account.address,
        domain: 'localhost',
        uri: 'http://localhost:3000',
        nonce: 'nonce123456',
        issuedAt: new Date('2026-07-31T12:00:00.000Z'),
      });

      expect(message).toContain('localhost wants you to sign in');
      expect(message).toContain('Sign in to Aether AI');
      expect(message).toContain('URI: http://localhost:3000');
      expect(message).toContain('Nonce: nonce123456');
      expect(message).toContain('Chain ID: 1');
      expect(message).toContain('Issued At: 2026-07-31T12:00:00.000Z');
    });
  });

  describe('verifyMessage', () => {
    it('verifies a valid signature', async () => {
      const nonce = service.generateNonce();
      const message = service.buildMessage({
        address: account.address,
        domain: 'localhost',
        uri: 'http://localhost:3000',
        nonce,
        issuedAt: new Date(),
      });
      const signature = await account.signMessage({ message });

      await expect(
        service.verifyMessage(message, account.address, signature),
      ).resolves.toBe(true);
    });

    it('rejects a signature from a different account', async () => {
      const message = service.buildMessage({
        address: account.address,
        domain: 'localhost',
        uri: 'http://localhost:3000',
        nonce: service.generateNonce(),
        issuedAt: new Date(),
      });
      const signature = await account.signMessage({ message });
      const otherAccount = privateKeyToAccount(`0x${'22'.repeat(32)}`);

      await expect(
        service.verifyMessage(message, otherAccount.address, signature),
      ).resolves.toBe(false);
    });
  });
});
