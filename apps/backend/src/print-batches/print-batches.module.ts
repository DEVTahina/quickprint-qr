import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { SupabaseModule } from '../supabase/supabase.module.js';
import { PrintBatchesController } from './print-batches.controller.js';
import { PrintBatchesService } from './print-batches.service.js';

@Module({
  imports: [AuthModule, SupabaseModule],
  controllers: [PrintBatchesController],
  providers: [PrintBatchesService],
})
export class PrintBatchesModule {}
