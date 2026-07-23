import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { RagService } from './rag.service';
import { CreateRagDto } from './dto/create-rag.dto';
import { UpdateRagDto } from './dto/update-rag.dto';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post()
  create(@Body() createRagDto: CreateRagDto) {
    return this.ragService.create(createRagDto);
  }

  @Get()
  findAll() {
    return this.ragService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ragService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRagDto: UpdateRagDto) {
    return this.ragService.update(+id, updateRagDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ragService.remove(+id);
  }
}
