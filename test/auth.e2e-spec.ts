import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { execSync } from 'node:child_process';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { privateKeyToAccount } from 'viem/accounts';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor';
import { PrismaService } from './../src/prisma/prisma.service';

jest.setTimeout(60_000);

const TEST_DB_URL =
  'postgresql://postgres:postgres@localhost:5432/aether_ai_test?schema=public';

const WALLET_KEY = `0x${'33'.repeat(32)}` as const;
const wallet = privateKeyToAccount(WALLET_KEY);

interface AuthData {
  accessToken?: string;
  message?: string;
  nonce?: string;
  expiresAt?: string;
  id?: string;
  email?: string;
  authType?: string;
  user?: {
    id: string;
    email: string;
    address: string | null;
  };
}

interface AuthEnvelope {
  statusCode: number;
  data: AuthData;
}

function parseAuth(res: { body: unknown }): AuthEnvelope {
  return res.body as AuthEnvelope;
}

function run(command: string, env: Record<string, string> = {}) {
  return execSync(command, {
    env: { ...process.env, ...env },
    cwd: process.cwd(),
  }).toString();
}

function ensureTestDatabase() {
  const exists = run(
    `docker exec aether-db psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='aether_ai_test'"`,
  ).trim();
  if (exists !== '1') {
    run(
      `docker exec aether-db psql -U postgres -c "CREATE DATABASE aether_ai_test"`,
    );
  }
  run('npx prisma migrate deploy', { DATABASE_URL: TEST_DB_URL });
}

process.env.DATABASE_URL = TEST_DB_URL;

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    ensureTestDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.nonce.deleteMany({});
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await app.close();
  });

  describe('register', () => {
    it('creates a user and sets the refresh cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'user@example.com',
          password: 'password123',
          username: 'alice',
        })
        .expect(201);
      const body = parseAuth(res);

      expect(body.data.accessToken).toEqual(expect.any(String));
      expect(body.data.authType).toBe('CREDENTIALS');
      expect(body.data.user?.email).toBe('user@example.com');

      const setCookie = res.headers['set-cookie'] as string[];
      const refreshCookie = setCookie.find((c) =>
        c.startsWith('aether_refresh='),
      );
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('Path=/auth');
    });

    it('rejects a duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'dup@example.com', password: 'password123' })
        .expect(201);
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'dup@example.com', password: 'password123' })
        .expect(409);
    });

    it('rejects invalid or extra payload fields', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email', password: 'password123' })
        .expect(400);
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'ok@example.com', password: 'short' })
        .expect(400);
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'ok@example.com', password: 'password123', admin: true })
        .expect(400);
    });
  });

  describe('login', () => {
    it('logs in with valid credentials', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'user@example.com', password: 'password123' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'password123' })
        .expect(200);
      const body = parseAuth(res);

      expect(body.data.accessToken).toEqual(expect.any(String));
      expect(body.data.authType).toBe('CREDENTIALS');
      expect(body.data.user?.email).toBe('user@example.com');
      const setCookie = res.headers['set-cookie'] as string[];
      expect(setCookie.some((c) => c.startsWith('aether_refresh='))).toBe(true);
    });

    it('rejects a wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'user@example.com', password: 'password123' })
        .expect(201);
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'wrong-password' })
        .expect(401);
    });

    it('rejects a login for an unknown email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'password123' })
        .expect(401);
    });
  });

  describe('me', () => {
    it('returns the current user with a valid access token', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'user@example.com', password: 'password123' })
        .expect(201);
      const registerBody = parseAuth(registerRes);
      const accessToken = registerBody.data.accessToken as string;

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const body = parseAuth(res);

      expect(body.data.user?.id).toBe(registerBody.data.user?.id);
      expect(body.data.user?.email).toBe('user@example.com');
      expect(body.data.authType).toBe('CREDENTIALS');
    });

    it('rejects a request without a token', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token and keeps the session alive', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/auth/register')
        .send({ email: 'user@example.com', password: 'password123' })
        .expect(201);

      const firstRefresh = await agent.post('/auth/refresh').expect(200);
      expect(parseAuth(firstRefresh).data.accessToken).toEqual(
        expect.any(String),
      );

      const secondRefresh = await agent.post('/auth/refresh').expect(200);
      expect(parseAuth(secondRefresh).data.accessToken).toEqual(
        expect.any(String),
      );
    });

    it('rejects a refresh without a cookie', async () => {
      await request(app.getHttpServer()).post('/auth/refresh').expect(401);
    });

    it('rejects a refresh after logout', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/auth/register')
        .send({ email: 'user@example.com', password: 'password123' })
        .expect(201);

      await agent.post('/auth/logout').expect(200);
      await agent.post('/auth/refresh').expect(401);
    });

    it('silently refreshes a wallet session with a matching address', async () => {
      const agent = request.agent(app.getHttpServer());
      const nonceRes = await agent
        .post('/auth/nonce')
        .send({ address: wallet.address, uri: 'http://localhost:3000' })
        .expect(201);
      const nonceBody = parseAuth(nonceRes);
      const message = nonceBody.data.message as string;
      const nonce = nonceBody.data.nonce as string;
      const signature = await wallet.signMessage({ message });
      await agent
        .post('/auth/verify')
        .send({ address: wallet.address, nonce, signature })
        .expect(201);

      const res = await agent
        .post('/auth/refresh')
        .send({ address: wallet.address })
        .expect(200);
      const body = parseAuth(res);

      expect(body.data.accessToken).toEqual(expect.any(String));
      expect(body.data.authType).toBe('WALLET');
      expect(body.data.user?.address).toBe(wallet.address);
    });

    it('rejects a refresh with a non-matching wallet address', async () => {
      const agent = request.agent(app.getHttpServer());
      const nonceRes = await agent
        .post('/auth/nonce')
        .send({ address: wallet.address, uri: 'http://localhost:3000' })
        .expect(201);
      const nonceBody = parseAuth(nonceRes);
      const message = nonceBody.data.message as string;
      const nonce = nonceBody.data.nonce as string;
      const signature = await wallet.signMessage({ message });
      await agent
        .post('/auth/verify')
        .send({ address: wallet.address, nonce, signature })
        .expect(201);

      const otherWallet = privateKeyToAccount(`0x${'55'.repeat(32)}`);
      await agent
        .post('/auth/refresh')
        .send({ address: otherWallet.address })
        .expect(401);
    });

    it('rejects an address on a credentials session', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/auth/register')
        .send({ email: 'user@example.com', password: 'password123' })
        .expect(201);

      await agent
        .post('/auth/refresh')
        .send({ address: wallet.address })
        .expect(401);
    });

    it('rejects a malformed address on refresh', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/auth/register')
        .send({ email: 'user@example.com', password: 'password123' })
        .expect(201);

      await agent
        .post('/auth/refresh')
        .send({ address: 'not-an-address' })
        .expect(400);
    });
  });

  describe('wallet (SIWE)', () => {
    it('requests a nonce and verifies a signature', async () => {
      const nonceRes = await request(app.getHttpServer())
        .post('/auth/nonce')
        .send({ address: wallet.address, uri: 'http://localhost:3000' })
        .expect(201);
      const nonceBody = parseAuth(nonceRes);

      const message = nonceBody.data.message as string;
      const nonce = nonceBody.data.nonce as string;
      expect(message).toContain('Sign in to Aether AI');

      const signature = await wallet.signMessage({ message });

      const res = await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ address: wallet.address, nonce, signature })
        .expect(201);
      const body = parseAuth(res);

      expect(body.data.user?.address).toBe(wallet.address);
      expect(body.data.authType).toBe('WALLET');
      expect(body.data.accessToken).toEqual(expect.any(String));
      const setCookie = res.headers['set-cookie'] as string[];
      expect(setCookie.some((c) => c.startsWith('aether_refresh='))).toBe(true);
    });

    it('rejects a replayed nonce', async () => {
      const nonceRes = await request(app.getHttpServer())
        .post('/auth/nonce')
        .send({ address: wallet.address, uri: 'http://localhost:3000' })
        .expect(201);
      const nonceBody = parseAuth(nonceRes);
      const message = nonceBody.data.message as string;
      const nonce = nonceBody.data.nonce as string;
      const signature = await wallet.signMessage({ message });

      await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ address: wallet.address, nonce, signature })
        .expect(201);
      await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ address: wallet.address, nonce, signature })
        .expect(401);
    });

    it('rejects a signature from the wrong account', async () => {
      const nonceRes = await request(app.getHttpServer())
        .post('/auth/nonce')
        .send({ address: wallet.address, uri: 'http://localhost:3000' })
        .expect(201);
      const nonceBody = parseAuth(nonceRes);
      const message = nonceBody.data.message as string;
      const nonce = nonceBody.data.nonce as string;
      const otherWallet = privateKeyToAccount(`0x${'44'.repeat(32)}`);
      const signature = await otherWallet.signMessage({ message });

      await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ address: wallet.address, nonce, signature })
        .expect(401);
    });
  });
});
