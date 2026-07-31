import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,20}$/, {
    message:
      'username must be 3-20 characters using letters, numbers, or underscores',
  })
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;
}
