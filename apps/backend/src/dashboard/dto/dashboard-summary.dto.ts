import { ApiProperty } from '@nestjs/swagger';

import type { DashboardSummary } from '../types/dashboard.js';

export class DashboardSummaryDto implements DashboardSummary {
  @ApiProperty({
    example: 1,
    description: 'Documents non supprimes, toutes sessions confondues',
  })
  received!: number;

  @ApiProperty({
    example: 1,
    description: "Documents en attente d'impression",
  })
  pending!: number;

  @ApiProperty({ example: 0, description: 'Documents marques comme imprimes' })
  printed!: number;

  @ApiProperty({ example: 1, description: 'Sessions actives et non expirees' })
  activeSessions!: number;
}
