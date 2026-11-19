import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsUUID,
} from 'class-validator';

import type { MutableDocumentStatus } from '../types/document.js';

export const MUTABLE_DOCUMENT_STATUSES: MutableDocumentStatus[] = [
  'received',
  'printed',
];

/** Selection de documents, bornee pour eviter les requetes massives. */
export class DocumentIdsDto {
  @ApiProperty({
    description: 'Identifiants des documents selectionnes (100 au maximum)',
    type: String,
    isArray: true,
    format: 'uuid',
    example: ['6b1f0f2e-3a4c-4f5d-9a6b-7c8d9e0f1a2b'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  ids!: string[];
}

export class DeleteDocumentsDto extends DocumentIdsDto {}

export class UpdateDocumentsStatusDto extends DocumentIdsDto {
  @ApiProperty({
    description: 'Nouveau statut applique a toute la selection',
    enum: MUTABLE_DOCUMENT_STATUSES,
    example: 'printed',
  })
  @IsIn(MUTABLE_DOCUMENT_STATUSES)
  status!: MutableDocumentStatus;
}
