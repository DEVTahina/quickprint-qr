import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import type {
  DocumentSortOrder,
  DocumentStatus,
} from '../types/document.js';

export const DOCUMENT_STATUSES: DocumentStatus[] = [
  'received',
  'printed',
  'deleted',
];

export class ListDocumentsDto {
  @ApiPropertyOptional({
    description: 'Recherche partielle sur le nom du fichier (insensible a la casse)',
    example: 'QTC',
    maxLength: 120,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtre sur le statut du document',
    enum: DOCUMENT_STATUSES,
    example: 'received',
  })
  @IsOptional()
  @IsIn(DOCUMENT_STATUSES)
  status?: DocumentStatus;

  @ApiPropertyOptional({
    description: "Filtre sur la session de reception d'origine",
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @ApiPropertyOptional({
    description:
      'Debut de la periode de depot (date ISO 8601, heure locale convertie par le frontend)',
    format: 'date-time',
    example: '2026-11-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  dateFrom?: string;

  @ApiPropertyOptional({
    description:
      'Fin de la periode de depot (date ISO 8601, heure locale convertie par le frontend)',
    format: 'date-time',
    example: '2026-11-30T23:59:59.999Z',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Ordre de tri par date de depot',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort?: DocumentSortOrder;

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
    description: 'Nombre de documents par page',
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
