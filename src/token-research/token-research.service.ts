import { Injectable } from '@nestjs/common';
import { CreateTokenResearchDto } from './dto/create-token-research.dto';
import { UpdateTokenResearchDto } from './dto/update-token-research.dto';

@Injectable()
export class TokenResearchService {
  create(_createTokenResearchDto: CreateTokenResearchDto) {
    return 'This action adds a new tokenResearch';
  }

  findAll() {
    return `This action returns all tokenResearch`;
  }

  findOne(id: number) {
    return `This action returns a #${id} tokenResearch`;
  }

  update(id: number, _updateTokenResearchDto: UpdateTokenResearchDto) {
    return `This action updates a #${id} tokenResearch`;
  }

  remove(id: number) {
    return `This action removes a #${id} tokenResearch`;
  }
}
