import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const UUID_SHAPE_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export class AssignChildFollowUpDto {
  @Matches(UUID_SHAPE_REGEX, { message: 'childId must be a UUID' })
  childId: string;

  @Matches(UUID_SHAPE_REGEX, { message: 'assigneeUserId must be a UUID' })
  assigneeUserId: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['overdue', 'zero-dose', 'missed', 'failed-reminder'])
  queueType: 'overdue' | 'zero-dose' | 'missed' | 'failed-reminder';

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  notes?: string;
}
