import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RequestLoggerMiddleware } from './common/middlewares/request-logger.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { ProvidersModule } from './providers/providers.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AiModule } from './ai/ai.module';
import { ChatsModule } from './chats/chats.module';
import { ConversationsModule } from './conversations/conversations.module';
import { PromptsModule } from './prompts/prompts.module';
import { WalletsModule } from './wallets/wallets.module';
import { BlockchainsModule } from './blockchains/blockchains.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { TokenResearchModule } from './token-research/token-research.module';
import { SmartContractsModule } from './smart-contracts/smart-contracts.module';
import { MemoryModule } from './memory/memory.module';
import { RagModule } from './rag/rag.module';
import { AgentsModule } from './agents/agents.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    PrismaModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    ProvidersModule,
    AuthModule,
    UsersModule,
    AiModule,
    ChatsModule,
    ConversationsModule,
    PromptsModule,
    WalletsModule,
    BlockchainsModule,
    PortfolioModule,
    TokenResearchModule,
    SmartContractsModule,
    MemoryModule,
    RagModule,
    AgentsModule,
    NotificationsModule,
    AnalyticsModule,
    AdminModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
