import { Type } from 'class-transformer';
import { IsInt, IsLatitude, IsLongitude, IsOptional, IsString, Max, Min } from 'class-validator';

export class NearbyQueryDto {
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(50_000)
  radiusMeters = 5000;

  @IsOptional()
  @IsString()
  category?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 30;
}
