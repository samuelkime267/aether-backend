import { Injectable } from '@nestjs/common';

export interface RootInfo {
  name: string;
  version: string;
  description: string;
  status: string;
  docs: string;
  health: string;
}

@Injectable()
export class AppService {
  getRoot(): RootInfo {
    return {
      name: 'Aether AI API',
      version: '1.0.0',
      description:
        'Backend for the Aether Web3 AI Operating System. Authentication (SIWE, email/password, Google), user management, and AI orchestration.',
      status: 'operational',
      docs: '/doc',
      health: '/health',
    };
  }
}
