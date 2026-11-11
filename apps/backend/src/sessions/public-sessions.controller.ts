import { Controller, Get, Header, Param } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { PublicPrintSessionDto } from './dto/print-session.dto.js';
import { SessionsService } from './sessions.service.js';

/**
 * Route publique appelee par la page ouverte apres le scan du QR Code.
 * Elle valide le token cote backend et ne donne acces a aucun document.
 */
@ApiTags('public-sessions')
@Controller('public/sessions')
export class PublicSessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get(':token')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: "Verifie le token d'une session de reception" })
  @ApiOkResponse({ type: PublicPrintSessionDto })
  @ApiNotFoundResponse({ description: 'Token inconnu ou invalide' })
  inspect(@Param('token') token: string): Promise<PublicPrintSessionDto> {
    return this.sessions.inspectToken(token);
  }
}
