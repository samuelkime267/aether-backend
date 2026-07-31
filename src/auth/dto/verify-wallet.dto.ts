import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { IsEthereumAddress } from '../../common/validators/is-ethereum-address';
import { IsHexSignature } from '../../common/validators/is-hex-signature';

export class VerifyWalletDto {
  @IsEthereumAddress()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  nonce: string;

  @IsHexSignature()
  @IsNotEmpty()
  signature: string;

  @IsOptional()
  @IsEmail()
  email?: string;

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
