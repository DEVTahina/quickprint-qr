import { Module } from '@nestjs/common';

import { SessionsModule } from '../sessions/sessions.module.js';
import { SupabaseModule } from '../supabase/supabase.module.js';
import { PublicUploadsController } from './public-uploads.controller.js';
import { UploadsService } from './uploads.service.js';

@Module({
  imports: [SessionsModule, SupabaseModule],
  controllers: [PublicUploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}
