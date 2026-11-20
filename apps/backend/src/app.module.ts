import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { validateEnvironment } from './config/env.validation.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { MaintenanceModule } from './maintenance/maintenance.module.js';
import { PrintBatchesModule } from './print-batches/print-batches.module.js';
import { SessionsModule } from './sessions/sessions.module.js';
import { SupabaseModule } from './supabase/supabase.module.js';
import { UploadsModule } from './uploads/uploads.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env'],
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
      { name: 'uploads', ttl: 60_000, limit: 60 },
    ]),
    SupabaseModule,
    AuthModule,
    SessionsModule,
    DashboardModule,
    DocumentsModule,
    PrintBatchesModule,
    UploadsModule,
    MaintenanceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
