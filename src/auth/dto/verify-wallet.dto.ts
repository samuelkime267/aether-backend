import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEthereumAddress } from '../../common/validators/is-ethereum-address';
import { IsHexSignature } from '../../common/validators/is-hex-signature';

export class VerifyWalletDto {
  @ApiProperty({
    description: 'Ethereum wallet address that signed the message',
    example: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
  })
  @IsEthereumAddress()
  @IsNotEmpty()
  address: string;

  @ApiProperty({
    description: 'Nonce returned from POST /auth/nonce',
    example: '0123...def',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  nonce: string;

  @ApiProperty({
    description: 'SIWE signature of the message, hex-encoded',
    example: '0x3a4b5c6d...',
  })
  @IsHexSignature()
  @IsNotEmpty()
  signature: string;

  @ApiPropertyOptional({
    description: 'Email to attach on first sign-in (409 if already used)',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Username to attach on first sign-in (3-20 chars)',
    example: 'alice',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,20}$/, {
    message:
      'username must be 3-20 characters using letters, numbers, or underscores',
  })
  username?: string;

  @ApiPropertyOptional({ example: 'Alice' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Example' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;
}
