import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { SupabaseModule } from '../supabase/supabase.module.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';

@Module({
  imports: [AuthModule, SupabaseModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
