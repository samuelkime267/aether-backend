import { Injectable } from '@nestjs/common';
import { CreateSmartContractDto } from './dto/create-smart-contract.dto';
import { UpdateSmartContractDto } from './dto/update-smart-contract.dto';

@Injectable()
export class SmartContractsService {
  create(_createSmartContractDto: CreateSmartContractDto) {
    return 'This action adds a new smartContract';
  }

  findAll() {
    return `This action returns all smartContracts`;
  }

  findOne(id: number) {
    return `This action returns a #${id} smartContract`;
  }

  update(id: number, _updateSmartContractDto: UpdateSmartContractDto) {
    return `This action updates a #${id} smartContract`;
  }

  remove(id: number) {
    return `This action removes a #${id} smartContract`;
  }
}
