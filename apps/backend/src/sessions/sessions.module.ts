import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { SupabaseModule } from '../supabase/supabase.module.js';
import { PublicSessionsController } from './public-sessions.controller.js';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';

@Module({
  imports: [AuthModule, SupabaseModule],
  controllers: [SessionsController, PublicSessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
