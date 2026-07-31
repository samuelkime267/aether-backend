import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { getAddress, verifyMessage } from 'viem';
import type { Address, Hex } from 'viem';
import { createSiweMessage } from 'viem/siwe';

export interface SiweMessageParams {
  address: Address;
  domain: string;
  uri: string;
  nonce: string;
  issuedAt: Date;
  chainId?: number;
}

@Injectable()
export class SiweService {
  generateNonce(): string {
    return randomBytes(32).toString('hex');
  }

  checksum(address: string): Address {
    return getAddress(address);
  }

  buildMessage(params: SiweMessageParams): string {
    return createSiweMessage({
      address: params.address,
      chainId: params.chainId ?? 1,
      domain: params.domain,
      nonce: params.nonce,
      uri: params.uri,
      version: '1',
      issuedAt: params.issuedAt,
      statement: 'Sign in to Aether AI',
    });
  }

  verifyMessage(
    message: string,
    address: Address,
    signature: Hex,
  ): Promise<boolean> {
    return verifyMessage({ address, message, signature });
  }
}
