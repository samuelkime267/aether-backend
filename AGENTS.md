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
- **`npm run lint` currently fails with ~54 pre-existing errors** in the scaffolded boilerplate (unused DTO params, `@typescript-eslint/no-unsafe-*` from `recommendedTypeChecked`, `require-await`). Don't fix them all; don't add new ones.
- **`Embedding.vector` needs pgvector.** The schema declares `extensions = [vector]` (with `previewFeatures = ["postgresqlExtensions"]` in the generator block — required even in Prisma 7.9). The compose db image is a locally built `aether-pgvector:pg17` (postgres:17 + `postgresql-17-pgvector`, because Docker Hub was unreachable when `pgvector/pgvector:pg15` was needed; swap back when reachable). `prisma db push` will fail with `extension "vector" is not available` against any Postgres server that lacks pgvector — install it there or the migration dies on `CREATE EXTENSION vector`.
- **`.env.example` is gitignored and does not exist**, despite the README telling you to copy it. Env is read via `process.env` (no `ConfigModule`); `JWT_SECRET` has a hardcoded dev fallback in `src/auth/jwt.strategy.ts`.
- Husky + commitlint are devDependencies/config only — **no hooks are installed** (no `.husky/`, no `prepare` script), so commits are not auto-validated.

## Architecture

- Mostly scaffolded (`scaffold.js` ran `nest g resource`): each `src/<feature>/` module is placeholder CRUD returning string stubs; **no DB access exists yet** — there is no `PrismaService` and no `@nestjs/bullmq`/`ioredis`/`openai` wiring despite those deps being installed.
- `src/providers/providers.module.ts` is the intended home for external integrations (OpenAI, Gemini, Anthropic, CoinGecko, etc.); providers are commented-out placeholders.
- Every feature module must be registered in `src/app.module.ts` imports (19 are registered there now).
- New feature modules: follow the existing `module/controller/service/dto/entities` layout. DTOs use `class-validator`; `src/main.ts` applies a global `ValidationPipe` (`whitelist`, `transform`, `forbidNonWhitelisted`), `AllExceptionsFilter`, and `TransformInterceptor`.
- Prettier: `singleQuote`, `trailingComma: all`; ESLint's prettier rule uses `endOfLine: "auto"` (CRLF-safe on Windows).
