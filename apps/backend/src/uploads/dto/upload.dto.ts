import { ApiProperty } from '@nestjs/swagger';

import type {
  FinalizedDocument,
  UploadAuthorization,
} from '../types/upload.js';

export class UploadAuthorizationDto implements UploadAuthorization {
  @ApiProperty({ format: 'uuid' })
  intentId!: string;

  @ApiProperty({
    description: "URL signée Supabase pour l'envoi direct du PDF",
    example:
      'https://example.supabase.co/storage/v1/object/upload/sign/quickprint-documents/sessions/00000000-0000-0000-0000-000000000000/00000000-0000-0000-0000-000000000000.pdf?token=exemple',
  })
  signedUrl!: string;

  @ApiProperty({ description: "Jeton d'upload signé, à usage unique" })
  token!: string;

  @ApiProperty({
    description: 'Chemin généré par le serveur dans le bucket privé',
    example:
      'sessions/00000000-0000-0000-0000-000000000000/00000000-0000-0000-0000-000000000000.pdf',
  })
  path!: string;

  @ApiProperty({
    format: 'date-time',
    description: "Fin de la fenêtre de finalisation côté backend",
  })
  expiresAt!: string;
}

export class FinalizedDocumentDto implements FinalizedDocument {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'CV.pdf' })
  originalName!: string;

  @ApiProperty({ example: 245760 })
  sizeBytes!: number;

  @ApiProperty({ format: 'date-time' })
  uploadedAt!: string;
}
