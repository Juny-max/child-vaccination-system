import { IsUUID, IsNotEmpty, IsString, IsOptional } from 'class-validator';

/**
 * Transfer Out DTO
 * Used when a mother/child leaves the CHW's catchment area
 * Sets child's catchment_area_id to NULL (soft disconnect)
 */
export class TransferOutDto {
  @IsUUID()
  @IsNotEmpty()
  childId: string;

  @IsString()
  @IsOptional()
  reason?: string; // e.g., "Family relocated to Kumasi"
}

/**
 * Transfer In DTO
 * Used when a CHW finds a child from another area (via global search)
 * and wants to add them to their local register
 */
export class TransferInDto {
  @IsUUID()
  @IsNotEmpty()
  childId: string;

  @IsString()
  @IsOptional()
  notes?: string; // e.g., "Mother moved to this community last week"
}

/**
 * Transfer Pull DTO
 * Used for the "Pull Mechanism" - forcefully pulling a child from another
 * CHW's catchment area without waiting for them to transfer out
 */
export class TransferPullDto {
  @IsUUID()
  @IsNotEmpty()
  childId: string;

  @IsString()
  @IsOptional()
  notes?: string; // e.g., "Family moved to my area, pulling from old registration"
}

/**
 * Response for transfer operations
 */
export class TransferResultDto {
  success: boolean;
  message: string;
  childId: string;
  childName: string;
  previousCatchment?: string;
  newCatchment?: string;
  timestamp: string;
}

/**
 * Response for pull transfer operations (includes wasPulled flag)
 */
export class TransferPullResultDto extends TransferResultDto {
  wasPulled: boolean;
  newCatchmentId?: string;
}
