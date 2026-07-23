import { PartialType } from '@nestjs/swagger';
import { CreateRagDto } from './create-rag.dto';

export class UpdateRagDto extends PartialType(CreateRagDto) {}
