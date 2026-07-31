import { IsOptional } from 'class-validator';
import { IsEthereumAddress } from '../../common/validators/is-ethereum-address';

export class RefreshDto {
  @IsOptional()
  @IsEthereumAddress()
  address?: string;
}
