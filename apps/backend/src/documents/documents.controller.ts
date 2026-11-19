import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentAdmin } from '../auth/decorators/current-admin.decorator.js';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard.js';
import type { AdminProfile } from '../auth/types/admin-profile.js';
import { DocumentsService } from './documents.service.js';
import {
  DeleteDocumentsDto,
  UpdateDocumentsStatusDto,
} from './dto/document-actions.dto.js';
import {
  DocumentDeletionDto,
  DocumentPageDto,
  DocumentPreviewDto,
  DocumentStatusUpdateDto,
} from './dto/document.dto.js';
import { ListDocumentsDto } from './dto/list-documents.dto.js';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @ApiOperation({
    summary:
      "Liste les documents deposes, avec recherche, filtres, tri et pagination",
  })
  @ApiOkResponse({ type: DocumentPageDto })
  @ApiBadRequestResponse({
    description: 'Parametres de filtre ou de pagination invalides',
  })
  @ApiUnauthorizedResponse({
    description: 'Token administrateur absent ou invalide',
  })
  @ApiForbiddenResponse({ description: 'Compte non autorise ou inactif' })
  list(
    @CurrentAdmin() admin: AdminProfile,
    @Query() query: ListDocumentsDto,
  ): Promise<DocumentPageDto> {
    return this.documents.list(admin.id, query);
  }

  @Get(':id/preview')
  @ApiOperation({
    summary:
      'Retourne une URL signee de courte duree pour consulter un PDF prive',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: DocumentPreviewDto })
  @ApiNotFoundResponse({ description: 'Document introuvable ou hors perimetre' })
  @ApiGoneResponse({ description: 'Document supprime' })
  preview(
    @CurrentAdmin() admin: AdminProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<DocumentPreviewDto> {
    return this.documents.preview(admin.id, id);
  }

  @Patch('status')
  @ApiOperation({
    summary:
      'Applique le statut recu ou imprime a une selection de documents',
  })
  @ApiOkResponse({ type: DocumentStatusUpdateDto })
  @ApiBadRequestResponse({ description: 'Selection invalide' })
  @ApiNotFoundResponse({ description: 'Document introuvable ou hors perimetre' })
  updateStatus(
    @CurrentAdmin() admin: AdminProfile,
    @Body() body: UpdateDocumentsStatusDto,
  ): Promise<DocumentStatusUpdateDto> {
    return this.documents.updateStatus(admin.id, body.ids, body.status);
  }

  @Post('delete')
  @ApiOperation({
    summary:
      'Supprime logiquement une selection de documents et retire les fichiers du stockage',
  })
  @ApiOkResponse({ type: DocumentDeletionDto })
  @ApiBadRequestResponse({ description: 'Selection invalide' })
  @ApiNotFoundResponse({ description: 'Document introuvable ou hors perimetre' })
  delete(
    @CurrentAdmin() admin: AdminProfile,
    @Body() body: DeleteDocumentsDto,
  ): Promise<DocumentDeletionDto> {
    return this.documents.softDelete(admin.id, body.ids);
  }
}
