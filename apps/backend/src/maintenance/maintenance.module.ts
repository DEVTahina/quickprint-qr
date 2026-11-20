import { Module } from '@nestjs/common';

import { SupabaseModule } from '../supabase/supabase.module.js';
import { MaintenanceService } from './maintenance.service.js';

/** Nettoyage periodique des sessions et envois expires. */
@Module({
  imports: [SupabaseModule],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
