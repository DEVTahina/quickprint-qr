import { ApiProperty } from '@nestjs/swagger';

import type { AdminProfile } from '../types/admin-profile.js';

export class AdminProfileDto implements AdminProfile {
  @ApiProperty({
    format: 'uuid',
    example: '8f14e45f-ceea-467f-a8f7-6a7a4f0e6b2c',
  })
  id!: string;

  @ApiProperty({ example: 'Awa Diop' })
  fullName!: string;

  @ApiProperty({ format: 'email', example: 'admin@imprimerie.com' })
  email!: string;

  @ApiProperty({ enum: ['admin'], example: 'admin' })
  role!: 'admin';
}
