import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentAdmin } from './decorators/current-admin.decorator.js';
import { AdminProfileDto } from './dto/admin-profile.dto.js';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard.js';
import type { AdminProfile } from './types/admin-profile.js';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({
    summary: "Retourne le profil de l'administrateur authentifie",
  })
  @ApiOkResponse({ type: AdminProfileDto })
  @ApiUnauthorizedResponse({ description: 'Token absent, invalide ou expire' })
  @ApiForbiddenResponse({
    description: 'Compte inconnu, desactive ou sans role administrateur',
  })
  me(@CurrentAdmin() admin: AdminProfile): AdminProfileDto {
    return admin;
  }
}
