import { ApiProperty } from '@nestjs/swagger';

import type {
  PrintBatch,
  PrintBatchCompletion,
  PrintBatchDocumentSummary,
  PrintBatchHistoryItem,
  PrintBatchPage,
  PrintBatchStatus,
} from '../types/print-batch.js';

const BATCH_STATUSES: PrintBatchStatus[] = [
  'pending',
  'processing',
  'completed',
  'failed',
];

export class PrintBatchDto implements PrintBatch {
  @ApiProperty({
    format: 'uuid',
    example: '9f3a2c8e-1b4d-4e6f-8a2b-3c4d5e6f7a8b',
  })
  id!: string;

  @ApiProperty({ example: 2, description: 'Nombre de documents du lot' })
  totalDocuments!: number;

  @ApiProperty({ enum: BATCH_STATUSES, example: 'pending' })
  status!: PrintBatchStatus;

  @ApiProperty({ format: 'date-time', example: '2026-11-19T12:40:00.000Z' })
  createdAt!: string;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
    type: String,
    example: null,
  })
  completedAt!: string | null;
}

export class PrintBatchCompletionDto
  extends PrintBatchDto
  implements PrintBatchCompletion
{
  @ApiProperty({
    example: 2,
    description: 'Documents passes au statut imprime lors de la cloture',
  })
  markedPrinted!: number;
}

export class PrintBatchDocumentDto implements PrintBatchDocumentSummary {
  @ApiProperty({ format: 'uuid' })
  documentId!: string;

  @ApiProperty({ example: 'QTC-WT-2026-00293069-a4.pdf' })
  originalName!: string;

  @ApiProperty({ example: 1, description: "Position dans l'ordre d'impression" })
  printOrder!: number;

  @ApiProperty({ enum: ['received', 'printed', 'deleted'], example: 'printed' })
  status!: PrintBatchDocumentSummary['status'];
}

export class PrintBatchHistoryDto
  extends PrintBatchDto
  implements PrintBatchHistoryItem
{
  @ApiProperty({ type: PrintBatchDocumentDto, isArray: true })
  documents!: PrintBatchDocumentSummary[];
}

export class PrintBatchPageDto implements PrintBatchPage {
  @ApiProperty({ type: PrintBatchHistoryDto, isArray: true })
  items!: PrintBatchHistoryItem[];

  @ApiProperty({ example: 1, description: 'Nombre total de lots filtres' })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}
