import { PartialType } from '@nestjs/swagger';
import { CreateTokenResearchDto } from './create-token-research.dto';

export class UpdateTokenResearchDto extends PartialType(
  CreateTokenResearchDto,
) {}
