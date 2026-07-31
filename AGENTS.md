# AGENTS.md

NestJS 11 + TypeScript backend for "Aether AI" (Web3 AI OS). Single package, CommonJS (`nodenext` module resolution), PostgreSQL via Prisma 7. Deploys are Docker-based.

## Commands

- `npm run start:dev` — watch mode dev server on `PORT` (default 3000).
- `npm run build` — `nest build`; requires Prisma client already generated (see below).
- `npm test` — unit tests in `src/**/*.spec.ts` (jest `rootDir` is `src`). `npm run test:e2e` runs `test/*.e2e-spec.ts`.
- `npm run lint` — `eslint ... --fix`, so it **auto-modifies files**. `npm run format` likewise writes files.
- Prisma: `npx prisma generate`, `npx prisma migrate dev`, `npx prisma db push` (config in `prisma.config.ts`).
- `docker compose up -d` — Postgres (creds `postgres/postgres`, db `aether`, port 5432) and Redis (6379). `DATABASE_URL` in a gitignored local `.env` points at db `aether_ai` on localhost:5432 (the compose db auto-creates only `aether`; run `docker exec aether-db psql -U postgres -c "CREATE DATABASE aether_ai;"` once to match).

## Must-know gotchas

- **All `prisma` CLI commands require `DATABASE_URL` set**, even `generate`. `prisma.config.ts` reads `env('DATABASE_URL')` and errors with `Cannot resolve environment variable: DATABASE_URL` otherwise. A gitignored local `.env` (auto-loaded by `dotenv/config` in `prisma.config.ts`) normally supplies it; if absent, set it manually, e.g. `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aether_ai?schema=public"`. In PowerShell, use `$env:DATABASE_URL="..."` before the command.
- **Run `npx prisma generate` before `npm run build`/tests.** `src/common/guards/roles.guard.ts` imports `Role` from `@prisma/client`; Prisma 7 emits the client to `node_modules/@prisma/client` at generate time.
- **Prisma 7 requires a driver adapter at runtime** (the Rust engine is gone). `src/prisma/prisma.service.ts` instantiates `PrismaPg` from `@prisma/adapter-pg` using `process.env.DATABASE_URL` and throws if it's unset. `src/main.ts` loads `.env` via `import 'dotenv/config'`; the e2e specs override `DATABASE_URL` (auth spec) or rely on `.env` (app spec).
- **`npm run test:e2e` needs the Postgres container running.** `test/auth.e2e-spec.ts` self-provisions a dedicated `aether_ai_test` database (docker-exec `CREATE DATABASE` if missing + `prisma migrate deploy` against it), wipes users/nonces between tests, and overrides the `ThrottlerGuard` so rate limits don't apply.
- **`npm run lint` currently fails with ~46 pre-existing errors** in the scaffolded boilerplate (unused DTO params, `@typescript-eslint/no-unsafe-*` from `recommendedTypeChecked`, `require-await`). Don't fix them all; don't add new ones.
- **`Embedding.vector` needs pgvector.** The schema declares `extensions = [vector]` (with `previewFeatures = ["postgresqlExtensions"]` in the generator block — required even in Prisma 7.9). The compose db image is a locally built `aether-pgvector:pg17` (postgres:17 + `postgresql-17-pgvector`, because Docker Hub was unreachable when `pgvector/pgvector:pg15` was needed; swap back when reachable). `prisma db push` will fail with `extension "vector" is not available` against any Postgres server that lacks pgvector — install it there or the migration dies on `CREATE EXTENSION vector`.
- **Config is validated at boot via `src/config/env.ts` (`getConfig()`)** — no `@nestjs/config`/Joi. `DATABASE_URL` and `JWT_SECRET` are **always required** (no fallbacks); `FE_URL` is required when `NODE_ENV=production`. Missing vars throw a clear error listing them, so the app fails fast. `getConfig()` reads lazily and caches on first call — set `process.env.*` before anything invokes it (in unit tests that sign real tokens, e.g. `token.service.spec.ts` sets `JWT_SECRET` in `beforeAll`).
- **CORS is a single origin (`FE_URL`)** in `src/main.ts`; there is no wildcard/reflect (`origin: true`) fallback anymore. Dev default is `http://localhost:3000` via `getConfig()`. `FE_URL` also backs the SIWE origin/domain fallback in `auth.controller.ts`.
- **`.env.example` is committed** and defines the env contract (`DATABASE_URL`, `JWT_SECRET`, `FE_URL`, `PORT`, `NODE_ENV`, token TTLs). `.env` itself remains gitignored; copy the example and generate `JWT_SECRET` with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
- Husky + commitlint are devDependencies/config only — **no hooks are installed** (no `.husky/`, no `prepare` script), so commits are not auto-validated.

## Architecture

- Mostly scaffolded (`scaffold.js` ran `nest g resource`): each `src/<feature>/` module is placeholder CRUD returning string stubs. **Auth (`src/auth/`) is the one fully implemented feature** (wallet SIWE + email/password, JWT access + rotating refresh cookies); see `docs/auth.md`. There is no `@nestjs/bullmq`/`ioredis`/`openai` wiring despite those deps being installed.
- `src/prisma/prisma.module.ts` is a `@Global()` module exposing `PrismaService` (adapter-backed, see gotchas) — inject it without importing the module.
- `src/providers/providers.module.ts` is the intended home for external integrations (OpenAI, Gemini, Anthropic, CoinGecko, etc.); providers are commented-out placeholders.
- Every feature module must be registered in `src/app.module.ts` imports (19 are registered there now).
- New feature modules: follow the existing `module/controller/service/dto/entities` layout. DTOs use `class-validator`; `src/main.ts` applies a global `ValidationPipe` (`whitelist`, `transform`, `forbidNonWhitelisted`), `AllExceptionsFilter`, and `TransformInterceptor`.
- Prettier: `singleQuote`, `trailingComma: all`; ESLint's prettier rule uses `endOfLine: "auto"` (CRLF-safe on Windows).
