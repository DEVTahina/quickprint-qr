import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', description: "Etat de sante de l'API" })
  status: 'ok';

  @ApiProperty({ example: 'quickprint-qr-api' })
  service: string;

  @ApiProperty({ example: '0.1.0' })
  version: string;

  @ApiProperty({ example: '2026-11-09T10:00:00.000Z' })
  timestamp: string;
}
