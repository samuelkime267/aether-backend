# Aether AI Backend Foundation

This is the production-ready backend foundation for **Aether AI**, an AI Operating System for Web3. 

## Features

- **NestJS Architecture**: Modular, feature-based, enterprise-grade structure.
- **Prisma & PostgreSQL**: Robust ORM with strong typing and schema generation.
- **JWT & Passport**: Pre-configured authentication system.
- **Docker Compose**: Pre-configured for PostgreSQL and Redis.
- **Development Tooling**: ESLint, Prettier, Husky, and Commitlint.
- **API Documentation**: Swagger pre-configured.

## Folder Structure

```
src/
├── ai/                # Core AI handling and orchestration
├── agents/            # Specialized AI Agents for Web3
├── analytics/         # Usage and token analytics
├── auth/              # JWT based authentication
├── blockchains/       # Blockchain data handling
├── chats/             # Chat orchestration and sessions
├── common/            # Global decorators, filters, interceptors, guards, middlewares
├── conversations/     # Chat conversation metadata
├── health/            # Liveness and readiness probes
├── memory/            # Agent conversational memory management
├── notifications/     # In-app and push notifications
├── portfolio/         # User wallet portfolio tracking
├── prompts/           # System and user prompts management
├── providers/         # External integrations (OpenAI, Gemini, Anthropic, CoinGecko, etc.)
├── rag/               # Retrieval-Augmented Generation implementation
├── smart-contracts/   # Smart contract auditing and intelligence
├── token-research/    # Token intelligence and fundamentals
├── users/             # User management
├── wallets/           # Wallet intelligence and tracking
└── main.ts            # Application entry point
```

## Setup & Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Copy `.env.example` to `.env` and fill in the required values.
   ```bash
   cp .env.example .env
   ```

3. **Start Services via Docker**:
   Ensure Docker is running, then start PostgreSQL and Redis:
   ```bash
   docker-compose up -d
   ```

4. **Initialize Database**:
   Push the Prisma schema to the database:
   ```bash
   npx prisma db push
   ```
   Or generate migrations if you prefer:
   ```bash
   npx prisma migrate dev --name init
   ```

5. **Start the Application**:
   ```bash
   # Development watch mode
   npm run start:dev
   ```

## Workflow & Guidelines

- **Husky & Commitlint**: This project enforces conventional commits and auto-formats code on commit.
- **Dependency Injection**: Use standard NestJS providers and inject them into controllers or other services.
- **Validation**: DTOs use `class-validator` and are automatically validated using a global validation pipe.
- **Error Handling**: Use built-in NestJS exceptions (e.g. `BadRequestException`, `NotFoundException`); they are caught and formatted globally.

## API Documentation

Swagger API documentation is automatically generated. When the server is running, visit:
[http://localhost:3000/api/docs](http://localhost:3000/api/docs)
