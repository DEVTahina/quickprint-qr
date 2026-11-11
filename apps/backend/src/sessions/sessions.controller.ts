import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentAdmin } from '../auth/decorators/current-admin.decorator.js';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard.js';
import type { AdminProfile } from '../auth/types/admin-profile.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import {
  CreatedPrintSessionDto,
  PrintSessionDto,
} from './dto/print-session.dto.js';
import { SessionsService } from './sessions.service.js';

@ApiTags('sessions')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Cree une session de reception et son token QR' })
  @ApiCreatedResponse({ type: CreatedPrintSessionDto })
  @ApiUnauthorizedResponse({ description: 'Token administrateur absent ou invalide' })
  @ApiForbiddenResponse({ description: 'Compte non autorise ou inactif' })
  create(
    @CurrentAdmin() admin: AdminProfile,
    @Body() dto: CreateSessionDto,
  ): Promise<CreatedPrintSessionDto> {
    return this.sessions.create(admin, dto);
  }

  @Get()
  @ApiOperation({ summary: "Liste les sessions de l'administrateur connecte" })
  @ApiOkResponse({ type: PrintSessionDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Token administrateur absent ou invalide' })
  list(@CurrentAdmin() admin: AdminProfile): Promise<PrintSessionDto[]> {
    return this.sessions.list(admin.id);
  }

  @Get(':id')
  @ApiOperation({ summary: "Consulte une session de l'administrateur connecte" })
  @ApiOkResponse({ type: PrintSessionDto })
  @ApiNotFoundResponse({ description: 'Session introuvable pour cet administrateur' })
  findOne(
    @CurrentAdmin() admin: AdminProfile,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PrintSessionDto> {
    return this.sessions.findOne(admin.id, id);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ferme une session active' })
  @ApiOkResponse({ type: PrintSessionDto })
  @ApiConflictResponse({ description: 'Session deja fermee, expiree ou inactive' })
  close(
    @CurrentAdmin() admin: AdminProfile,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PrintSessionDto> {
    return this.sessions.close(admin.id, id);
  }

  @Post(':id/renew')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: "Renouvelle une session avec un nouveau token et ferme l'ancienne",
  })
  @ApiCreatedResponse({ type: CreatedPrintSessionDto })
  @ApiConflictResponse({ description: 'Session deja fermee' })
  renew(
    @CurrentAdmin() admin: AdminProfile,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSessionDto,
  ): Promise<CreatedPrintSessionDto> {
    return this.sessions.renew(admin, id, dto);
  }
}
