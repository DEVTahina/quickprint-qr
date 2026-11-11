import { Module } from '@nestjs/common';

import { SupabaseModule } from '../supabase/supabase.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard.js';

@Module({
  imports: [SupabaseModule],
  controllers: [AuthController],
  providers: [AuthService, SupabaseAuthGuard],
  exports: [AuthService, SupabaseAuthGuard],
})
export class AuthModule {}
