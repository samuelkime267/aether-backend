import { Injectable } from '@nestjs/common';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';

@Injectable()
export class PortfolioService {
  create(_createPortfolioDto: CreatePortfolioDto) {
    return 'This action adds a new portfolio';
  }

  findAll() {
    return `This action returns all portfolio`;
  }

  findOne(id: number) {
    return `This action returns a #${id} portfolio`;
  }

  update(id: number, _updatePortfolioDto: UpdatePortfolioDto) {
    return `This action updates a #${id} portfolio`;
  }

  remove(id: number) {
    return `This action removes a #${id} portfolio`;
  }
}
