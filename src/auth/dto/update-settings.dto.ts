import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const MODELS = ['aether-crypto-v1', 'fast-router', 'deep-audit'] as const;

export class UpdateSettingsDto {
  @ApiPropertyOptional({
    description: 'Default AI model',
    enum: MODELS,
    example: 'aether-crypto-v1',
  })
  @IsOptional()
  @IsIn(MODELS, {
    message: 'selectedModel must be one of: aether-crypto-v1, fast-router, deep-audit',
  })
  selectedModel?: (typeof MODELS)[number];

  @ApiPropertyOptional({ description: 'Persist chat history', example: true })
  @IsOptional()
  @IsBoolean()
  saveHistory?: boolean;

  @ApiPropertyOptional({ description: 'Compact sidebar layout', example: false })
  @IsOptional()
  @IsBoolean()
  compactSidebar?: boolean;
}
