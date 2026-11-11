import { ApiProperty } from '@nestjs/swagger';

import type {
  CreatedPrintSession,
  PrintSessionStatus,
  PrintSessionSummary,
  PublicPrintSession,
} from '../types/print-session.js';

export class PrintSessionDto implements PrintSessionSummary {
  @ApiProperty({
    format: 'uuid',
    example: '0f42e5b4-13d9-4b39-bc0e-d83b9fce31f9',
  })
  id!: string;

  @ApiProperty({ enum: ['active', 'expired', 'closed'], example: 'active' })
  status!: PrintSessionStatus;

  @ApiProperty({ format: 'date-time', example: '2026-11-11T17:00:00.000Z' })
  expiresAt!: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 20 })
  maxFiles!: number;

  @ApiProperty({ format: 'date-time', example: '2026-11-11T15:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
    example: null,
    type: String,
  })
  closedAt!: string | null;
}

export class CreatedPrintSessionDto implements CreatedPrintSession {
  @ApiProperty({ type: PrintSessionDto })
  session!: PrintSessionDto;

  @ApiProperty({
    description:
      "Token secret du QR Code. Il n'est affiche qu'une seule fois et n'est jamais stocke en clair.",
    example: 'F3v7Yw9K2mQx8sN4pL6rT1cB5hJ0aZgE2uD8kM4nP6q',
  })
  token!: string;
}

export class PublicPrintSessionDto implements PublicPrintSession {
  @ApiProperty({ description: 'La session accepte-t-elle encore des depots ?' })
  valid!: boolean;

  @ApiProperty({ enum: ['active', 'expired', 'closed'], example: 'active' })
  status!: PrintSessionStatus;

  @ApiProperty({ format: 'date-time', example: '2026-11-11T17:00:00.000Z' })
  expiresAt!: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 20 })
  maxFiles!: number;
}
