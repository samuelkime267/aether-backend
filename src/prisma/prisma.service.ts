import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is not set. Provide it in the environment or a local .env file.',
      );
    }
    const isProd = process.env.NODE_ENV === 'production';
    super({
      adapter: new PrismaPg({
        connectionString,
        ...(isProd ? { ssl: { rejectUnauthorized: false } } : {}),
      }),
    });
  }

  async onModuleInit() {
    console.log('[PrismaService] connecting to database...');
    try {
      await this.$connect();
      console.log('[PrismaService] connected OK');
    } catch (error) {
      console.error('[PrismaService] CONNECT FAILED:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
