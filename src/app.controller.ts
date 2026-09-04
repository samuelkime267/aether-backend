import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { RootInfo } from './app.service';
import { AppService } from './app.service';

@ApiTags('root')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'API root', description: 'Returns API identity and pointers.' })
  @ApiResponse({
    status: 200,
    description: 'API info',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        version: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string' },
        docs: { type: 'string' },
        health: { type: 'string' },
      },
    },
  })
  getRoot(): RootInfo {
    return this.appService.getRoot();
  }
}
