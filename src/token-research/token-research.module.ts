import { Module } from '@nestjs/common';
import { TokenResearchService } from './token-research.service';
import { TokenResearchController } from './token-research.controller';

@Module({
  controllers: [TokenResearchController],
  providers: [TokenResearchService],
})
export class TokenResearchModule {}
