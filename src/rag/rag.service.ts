import { Injectable } from '@nestjs/common';
import { CreateRagDto } from './dto/create-rag.dto';
import { UpdateRagDto } from './dto/update-rag.dto';

@Injectable()
export class RagService {
  create(createRagDto: CreateRagDto) {
    return 'This action adds a new rag';
  }

  findAll() {
    return `This action returns all rag`;
  }

  findOne(id: number) {
    return `This action returns a #${id} rag`;
  }

  update(id: number, updateRagDto: UpdateRagDto) {
    return `This action updates a #${id} rag`;
  }

  remove(id: number) {
    return `This action removes a #${id} rag`;
  }
}
