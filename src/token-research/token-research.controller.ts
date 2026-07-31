import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { TokenResearchService } from './token-research.service';
import { CreateTokenResearchDto } from './dto/create-token-research.dto';
import { UpdateTokenResearchDto } from './dto/update-token-research.dto';

@Controller('token-research')
export class TokenResearchController {
  constructor(private readonly tokenResearchService: TokenResearchService) {}

  @Post()
  create(@Body() createTokenResearchDto: CreateTokenResearchDto) {
    return this.tokenResearchService.create(createTokenResearchDto);
  }

  @Get()
  findAll() {
    return this.tokenResearchService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tokenResearchService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateTokenResearchDto: UpdateTokenResearchDto,
  ) {
    return this.tokenResearchService.update(+id, updateTokenResearchDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tokenResearchService.remove(+id);
  }
}
