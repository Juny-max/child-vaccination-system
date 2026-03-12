import { IsString, IsNotEmpty, IsNumber, IsDateString, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class LogStockDto {
  @IsString()
  @IsNotEmpty()
  vaccineId: string;

  @IsString()
  @IsNotEmpty()
  batchNumber: string;

  @IsString()
  @IsOptional()
  lotNumber?: string;

  @IsString()
  @IsOptional()
  manufacturer?: string;

  @IsDateString()
  expiryDate: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantityReceived: number;

  @IsDateString()
  receivedDate: string;
}
