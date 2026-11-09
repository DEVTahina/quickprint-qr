import { Injectable } from '@nestjs/common';

import { HealthResponseDto } from './common/dto/health-response.dto.js';

const SERVICE_NAME = 'quickprint-qr-api';
const SERVICE_VERSION = '0.1.0';

@Injectable()
export class AppService {
  getHealth(): HealthResponseDto {
    return {
      status: 'ok',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      timestamp: new Date().toISOString(),
    };
  }
}
