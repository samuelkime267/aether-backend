import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isHex } from 'viem';

@ValidatorConstraint({ name: 'IsHexSignature', async: false })
export class IsHexSignatureConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return (
      typeof value === 'string' &&
      isHex(value, { strict: true }) &&
      value.length === 132
    );
  }

  defaultMessage(): string {
    return '$property must be a valid 65-byte hex signature';
  }
}

export function IsHexSignature(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsHexSignatureConstraint,
    });
  };
}
