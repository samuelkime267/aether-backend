import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsEthereumAddress } from '../../common/validators/is-ethereum-address';

export class RequestNonceDto {
  @IsEthereumAddress()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  uri: string;
}
