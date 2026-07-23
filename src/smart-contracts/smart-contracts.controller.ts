import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SmartContractsService } from './smart-contracts.service';
import { CreateSmartContractDto } from './dto/create-smart-contract.dto';
import { UpdateSmartContractDto } from './dto/update-smart-contract.dto';

@Controller('smart-contracts')
export class SmartContractsController {
  constructor(private readonly smartContractsService: SmartContractsService) {}

  @Post()
  create(@Body() createSmartContractDto: CreateSmartContractDto) {
    return this.smartContractsService.create(createSmartContractDto);
  }

  @Get()
  findAll() {
    return this.smartContractsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.smartContractsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSmartContractDto: UpdateSmartContractDto) {
    return this.smartContractsService.update(+id, updateSmartContractDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.smartContractsService.remove(+id);
  }
}
