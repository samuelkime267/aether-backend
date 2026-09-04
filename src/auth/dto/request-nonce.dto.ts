import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsEthereumAddress } from '../../common/validators/is-ethereum-address';

export class RequestNonceDto {
  @ApiProperty({
    description: 'Ethereum wallet address requesting a nonce',
    example: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
  })
  @IsEthereumAddress()
  @IsNotEmpty()
  address: string;

  @ApiProperty({
    description: 'The URI (origin) that will sign the message',
    example: 'http://localhost:3000',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  uri: string;
}
