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
  ApiCreatedResponse,
  ApiForbiddenResponse,
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
import { ListPrintBatchesDto } from './dto/list-print-batches.dto.js';
import {
  CompletePrintBatchDto,
  CreatePrintBatchDto,
} from './dto/print-batch.dto.js';
import {
  PrintBatchCompletionDto,
  PrintBatchDto,
  PrintBatchPageDto,
} from './dto/print-batch-response.dto.js';
import { PrintBatchesService } from './print-batches.service.js';
import type {
  PrintBatch,
  PrintBatchCompletion,
  PrintBatchPage,
} from './types/print-batch.js';

@ApiTags('print-batches')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('print-batches')
export class PrintBatchesController {
  constructor(private readonly batches: PrintBatchesService) {}

  @Get()
  @ApiOperation({
    summary:
      "Historique pagine des lots d'impression de l'administrateur connecte",
  })
  @ApiOkResponse({ type: PrintBatchPageDto })
  @ApiBadRequestResponse({
    description: 'Filtres, date ou pagination invalides',
  })
  @ApiUnauthorizedResponse({
    description: 'Token administrateur absent ou invalide',
  })
  @ApiForbiddenResponse({ description: 'Compte non autorise ou inactif' })
  list(
    @CurrentAdmin() admin: AdminProfile,
    @Query() query: ListPrintBatchesDto,
  ): Promise<PrintBatchPage> {
    return this.batches.list(admin.id, query);
  }

  @Post()
  @ApiOperation({
    summary:
      "Enregistre un lot d'impression dans l'ordre de selection des documents",
  })
  @ApiCreatedResponse({ type: PrintBatchDto })
  @ApiBadRequestResponse({
    description: 'Selection invalide ou document supprime',
  })
  @ApiNotFoundResponse({ description: 'Document introuvable ou hors perimetre' })
  @ApiUnauthorizedResponse({
    description: 'Token administrateur absent ou invalide',
  })
  @ApiForbiddenResponse({ description: 'Compte non autorise ou inactif' })
  create(
    @CurrentAdmin() admin: AdminProfile,
    @Body() body: CreatePrintBatchDto,
  ): Promise<PrintBatch> {
    return this.batches.create(admin.id, body.documentIds);
  }

  @Patch(':id/complete')
  @ApiOperation({
    summary:
      "Cloture un lot et marque explicitement ses documents comme imprimes",
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PrintBatchCompletionDto })
  @ApiNotFoundResponse({ description: "Lot d'impression introuvable" })
  @ApiUnauthorizedResponse({
    description: 'Token administrateur absent ou invalide',
  })
  @ApiForbiddenResponse({ description: 'Compte non autorise ou inactif' })
  complete(
    @CurrentAdmin() admin: AdminProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CompletePrintBatchDto,
  ): Promise<PrintBatchCompletion> {
    return this.batches.complete(admin.id, id, body.markPrinted);
  }
}
