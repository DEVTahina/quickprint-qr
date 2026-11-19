import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Length, Matches, Max, Min } from 'class-validator';

import { MAX_PDF_SIZE_BYTES } from '../../config/upload.config.js';

export class AuthorizeUploadDto {
  @ApiProperty({
    description: 'Nom du fichier fourni par le navigateur (jamais utilisé comme chemin)',
    example: 'CV.pdf',
    maxLength: 255,
  })
  @IsString()
  @Length(1, 255)
  @Matches(/\.pdf$/i, { message: 'Le fichier doit être un PDF.' })
  fileName!: string;

  @ApiProperty({
    description: 'Taille annoncée par le navigateur, en octets',
    example: 245760,
    minimum: 1,
    maximum: MAX_PDF_SIZE_BYTES,
  })
  @IsInt()
  @Min(1)
  @Max(MAX_PDF_SIZE_BYTES)
  sizeBytes!: number;
}
