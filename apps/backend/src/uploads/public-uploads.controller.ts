import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { AuthorizeUploadDto } from './dto/authorize-upload.dto.js';
import {
  FinalizedDocumentDto,
  UploadAuthorizationDto,
} from './dto/upload.dto.js';
import { UploadsService } from './uploads.service.js';

/**
 * Routes publiques d'envoi direct. Le token de session et les limites sont
 * toujours vérifiés côté backend avant de délivrer une URL signée.
 */
@ApiTags('public-uploads')
@Controller('public/sessions/:token/uploads')
@UseGuards(ThrottlerGuard)
export class PublicUploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  @Throttle({ uploads: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Autorise l'envoi direct d'un PDF" })
  @ApiCreatedResponse({ type: UploadAuthorizationDto })
  @ApiBadRequestResponse({ description: 'Nom ou taille invalides' })
  @ApiNotFoundResponse({ description: 'Session introuvable ou invalide' })
  @ApiConflictResponse({ description: 'Session fermée, expirée ou limite atteinte' })
  @ApiPayloadTooLargeResponse({ description: 'Fichier trop volumineux' })
  @ApiTooManyRequestsResponse({ description: "Trop de demandes d'envoi" })
  authorize(
    @Param('token') token: string,
    @Body() dto: AuthorizeUploadDto,
  ): Promise<UploadAuthorizationDto> {
    return this.uploads.authorize(token, dto);
  }

  @Post(':intentId/finalize')
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  @Throttle({ uploads: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: "Vérifie le PDF reçu et enregistre le document" })
  @ApiOkResponse({ type: FinalizedDocumentDto })
  @ApiNotFoundResponse({ description: 'Session ou autorisation introuvable' })
  @ApiConflictResponse({
    description: 'Fichier absent, session inactive ou limite atteinte',
  })
  @ApiGoneResponse({ description: "Autorisation d'envoi expirée" })
  @ApiPayloadTooLargeResponse({ description: 'Fichier trop volumineux' })
  @ApiUnsupportedMediaTypeResponse({ description: 'Fichier non PDF' })
  @ApiTooManyRequestsResponse({ description: 'Trop de finalisations' })
  finalize(
    @Param('token') token: string,
    @Param('intentId') intentId: string,
  ): Promise<FinalizedDocumentDto> {
    return this.uploads.finalize(token, intentId);
  }
}
