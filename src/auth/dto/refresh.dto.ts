import { IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEthereumAddress } from '../../common/validators/is-ethereum-address';

export class RefreshDto {
  @ApiPropertyOptional({
    description:
      'Wallet address for silent wallet re-auth (WALLET sessions only)',
    example: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
  })
  @IsOptional()
  @IsEthereumAddress()
  address?: string;
}
