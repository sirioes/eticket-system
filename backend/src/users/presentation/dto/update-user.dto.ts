import { IsBoolean, IsEnum, IsOptional, ValidateIf } from 'class-validator';
import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';

export class UpdateUserDto {
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsEnum(Divisi)
  divisi?: Divisi | null;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}
