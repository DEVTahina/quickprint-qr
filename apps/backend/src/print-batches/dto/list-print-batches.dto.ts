import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

import type { PrintBatchStatus } from '../types/print-batch.js';

export const PRINT_BATCH_STATUSES: PrintBatchStatus[] = [
  'pending',
  'processing',
  'completed',
  'failed',
];

/** Filtres et pagination de l'historique des lots d'impression. */
export class ListPrintBatchesDto {
  @ApiPropertyOptional({
    description: "Filtre sur l'etat du lot",
    enum: PRINT_BATCH_STATUSES,
    example: 'completed',
  })
  @IsOptional()
  @IsIn(PRINT_BATCH_STATUSES)
  status?: PrintBatchStatus;

  @ApiPropertyOptional({
    description: 'Debut de la periode de creation (date ISO 8601)',
    format: 'date-time',
    example: '2026-11-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Fin de la periode de creation (date ISO 8601)',
    format: 'date-time',
    example: '2026-11-30T23:59:59.999Z',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Ordre de tri par date de creation',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort?: 'asc' | 'desc';

  @ApiPropertyOptional({
    description: 'Page demandee, a partir de 1',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: "Nombre de lots par page",
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
