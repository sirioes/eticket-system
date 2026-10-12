import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export const MAX_USER_ID = 2_147_483_647;

export class UserIdParamDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_USER_ID)
  id!: number;
}
