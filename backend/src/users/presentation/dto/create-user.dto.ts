import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  fullName!: string;

  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsEnum(Divisi)
  divisi?: Divisi | null;

  @IsString()
  password!: string;
}
