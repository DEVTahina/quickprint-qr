import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateSessionDto {
  @ApiPropertyOptional({
    description: "Duree de validite de la session, en minutes",
    example: 120,
    minimum: 5,
    maximum: 1440,
    default: 120,
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  expiresInMinutes?: number;

  @ApiPropertyOptional({
    description: 'Nombre maximal de fichiers acceptes pendant la session',
    example: 5,
    minimum: 1,
    maximum: 20,
    default: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxFiles?: number;
}
