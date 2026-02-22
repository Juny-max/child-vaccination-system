// ============================================================================
// CHW Module DTOs - Data Transfer Objects
// ============================================================================

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

// Export transfer DTOs
export * from './transfer.dto';

// ============================================================================
// REQUEST DTOs
// ============================================================================

/**
 * Single CHW vaccination record for sync
 */
export class CHWVaccinationDto {
  @IsString()
  @IsNotEmpty()
  childId: string;

  @IsString()
  @IsNotEmpty()
  vaccineId: string;

  @IsString()
  @IsNotEmpty()
  vaccineName: string;

  @IsString()
  @IsNotEmpty()
  recordedDate: string; // ISO date string

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

/**
 * Batch sync CHW vaccinations from offline storage
 */
export class SyncCHWVaccinationsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CHWVaccinationDto)
  vaccinations: CHWVaccinationDto[];
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

/**
 * Result of syncing CHW vaccinations
 */
export class SyncResultDto {
  synced: number; // Number of successfully synced vaccinations
  failed: number; // Number of failed vaccinations
  errors: Array<{
    vaccination: CHWVaccinationDto;
    reason: string;
  }>;
}
