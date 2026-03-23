import {
  IsString,
  IsNotEmpty,
  IsDateString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

/**
 * Quick Search DTO
 * Search by exact match on child UUID or mother's phone number
 */
export class QuickSearchDto {
  @IsString()
  @IsNotEmpty({ message: 'Identifier (Child UUID or Mother Phone) is required' })
  @MinLength(3, { message: 'Identifier must be at least 3 characters' })
  @MaxLength(64, { message: 'Identifier must not exceed 64 characters' })
  @Matches(/^[0-9a-fA-F+()\-\s]+$/, {
    message: 'Identifier can only contain UUID or phone characters',
  })
  identifier: string;
}

/**
 * Advanced Search DTO
 * Search by child name, mother name, and date of birth
 * ALL three fields are required for this search type
 */
export class AdvancedSearchDto {
  @IsString()
  @IsNotEmpty({ message: 'Child name is required for advanced search' })
  @MinLength(2, { message: 'Child name must be at least 2 characters' })
  @MaxLength(80, { message: 'Child name must not exceed 80 characters' })
  childName: string;

  @IsString()
  @IsNotEmpty({ message: 'Mother name is required for advanced search' })
  @MinLength(2, { message: 'Mother name must be at least 2 characters' })
  @MaxLength(120, { message: 'Mother name must not exceed 120 characters' })
  motherName: string;

  @IsDateString({}, { message: 'Date of birth must be a valid date (YYYY-MM-DD)' })
  @IsNotEmpty({ message: 'Date of birth is required for advanced search' })
  dob: string;
}

/**
 * Search Result - Child data with catchment info for transfer decisions
 */
export class SearchResultDto {
  id: string;
  childId: string;
  childName: string;
  dateOfBirth: string;
  gender: string;
  motherName: string;
  motherPhone: string;
  village: string;
  nextVaccine: string;
  // Catchment info for transfer pull
  catchmentAreaId: string | null;
  currentZoneName: string | null;
  currentBranchId: string | null;
  // Flag to indicate if child needs to be pulled from another zone
  requiresPull: boolean;
}
