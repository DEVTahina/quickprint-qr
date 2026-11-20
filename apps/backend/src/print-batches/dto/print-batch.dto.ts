import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsUUID,
} from 'class-validator';

import { MAX_BATCH_DOCUMENTS } from '../types/print-batch.js';

/** Documents composant le lot, dans l'ordre d'impression choisi. */
export class CreatePrintBatchDto {
  @ApiProperty({
    description:
      "Identifiants des documents dans l'ordre d'impression (100 au maximum)",
    type: String,
    isArray: true,
    format: 'uuid',
    example: ['6b1f0f2e-3a4c-4f5d-9a6b-7c8d9e0f1a2b'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_BATCH_DOCUMENTS)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  documentIds!: string[];
}

/** Decision de l'administrateur apres l'ouverture de la boite d'impression. */
export class CompletePrintBatchDto {
  @ApiProperty({
    description:
      "Marquer les documents du lot comme imprimes (jamais automatique)",
    example: true,
  })
  @IsBoolean()
  markPrinted!: boolean;
}
