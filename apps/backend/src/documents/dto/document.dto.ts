import { ApiProperty } from '@nestjs/swagger';

import type {
  DocumentDeletion,
  DocumentPage,
  DocumentPreview,
  DocumentSession,
  DocumentStatus,
  DocumentStatusUpdate,
  DocumentSummary,
} from '../types/document.js';

export class DocumentSessionDto implements DocumentSession {
  @ApiProperty({
    format: 'uuid',
    example: 'bd4f66a6-434c-4c17-9627-85c7f7267c28',
  })
  id!: string;

  @ApiProperty({ format: 'date-time', example: '2026-11-19T08:31:24.860Z' })
  createdAt!: string;

  @ApiProperty({ enum: ['active', 'expired', 'closed'], example: 'closed' })
  status!: DocumentSession['status'];
}

export class DocumentDto implements DocumentSummary {
  @ApiProperty({
    format: 'uuid',
    example: '6b1f0f2e-3a4c-4f5d-9a6b-7c8d9e0f1a2b',
  })
  id!: string;

  @ApiProperty({
    format: 'uuid',
    example: 'bd4f66a6-434c-4c17-9627-85c7f7267c28',
  })
  sessionId!: string;

  @ApiProperty({
    type: DocumentSessionDto,
    nullable: true,
    description: "Session d'origine du document",
  })
  session!: DocumentSession | null;

  @ApiProperty({ example: 'QTC-WT-2026-00293069-a4.pdf', maxLength: 255 })
  originalName!: string;

  @ApiProperty({ example: 1_281_272, description: 'Taille du PDF en octets' })
  sizeBytes!: number;

  @ApiProperty({
    example: null,
    nullable: true,
    type: Number,
    description: "Nombre de pages, nul tant qu'il n'a pas ete determine",
  })
  pagesCount!: number | null;

  @ApiProperty({ enum: ['received', 'printed', 'deleted'], example: 'received' })
  status!: DocumentStatus;

  @ApiProperty({ format: 'date-time', example: '2026-11-19T08:32:52.117Z' })
  uploadedAt!: string;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
    type: String,
    example: null,
  })
  printedAt!: string | null;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
    type: String,
    example: null,
  })
  deletedAt!: string | null;
}

export class DocumentPreviewDto implements DocumentPreview {
  @ApiProperty({
    format: 'uuid',
    example: '6b1f0f2e-3a4c-4f5d-9a6b-7c8d9e0f1a2b',
  })
  id!: string;

  @ApiProperty({
    example:
      'https://<project>.supabase.co/storage/v1/object/sign/quickprint-documents/…',
    description: 'URL signee temporaire vers le PDF prive',
  })
  url!: string;

  @ApiProperty({ format: 'date-time', example: '2026-11-19T12:35:00.000Z' })
  expiresAt!: string;
}

export class DocumentStatusUpdateDto implements DocumentStatusUpdate {
  @ApiProperty({ example: 3, description: 'Nombre de documents mis a jour' })
  updated!: number;
}

export class DocumentDeletionDto implements DocumentDeletion {
  @ApiProperty({ example: 3, description: 'Nombre de documents supprimes' })
  deleted!: number;
}

export class DocumentPageDto implements DocumentPage {
  @ApiProperty({ type: DocumentDto, isArray: true })
  items!: DocumentSummary[];

  @ApiProperty({ example: 1, description: 'Nombre total de documents filtres' })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}
