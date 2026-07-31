import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isAddress } from 'viem';

@ValidatorConstraint({ name: 'IsEthereumAddress', async: false })
export class IsEthereumAddressConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isAddress(value);
  }

  defaultMessage(): string {
    return '$property must be a valid Ethereum address';
  }
}

export function IsEthereumAddress(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsEthereumAddressConstraint,
    });
  };
}
