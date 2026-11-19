import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentAdmin } from '../auth/decorators/current-admin.decorator.js';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard.js';
import type { AdminProfile } from '../auth/types/admin-profile.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardSummaryDto } from './dto/dashboard-summary.dto.js';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @ApiOperation({
    summary:
      "Compteurs du tableau de bord : documents recus, en attente, imprimes et sessions actives",
  })
  @ApiOkResponse({ type: DashboardSummaryDto })
  @ApiUnauthorizedResponse({
    description: 'Token administrateur absent ou invalide',
  })
  @ApiForbiddenResponse({ description: 'Compte non autorise ou inactif' })
  summary(@CurrentAdmin() admin: AdminProfile): Promise<DashboardSummaryDto> {
    return this.dashboard.summary(admin.id);
  }
}
