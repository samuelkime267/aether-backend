import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: 'a3f1c2e4-...' })
  id: string;

  @ApiProperty({ nullable: true, example: null })
  address: string | null;

  @ApiProperty({ nullable: true, example: null })
  walletAddress: string | null;

  @ApiProperty({ nullable: true, example: 'user@example.com' })
  email: string | null;

  @ApiProperty({ example: 'alice' })
  name: string;

  @ApiProperty({ nullable: true, example: 'alice' })
  username: string | null;

  @ApiProperty({ nullable: true, example: 'Alice' })
  firstName: string | null;

  @ApiProperty({ nullable: true, example: 'Example' })
  lastName: string | null;

  @ApiProperty({ enum: ['USER', 'ADMIN', 'AGENT'], example: 'USER' })
  role: string;

  @ApiProperty({ enum: ['FREE', 'PRO', 'ENTERPRISE'], example: 'FREE' })
  tier: string;

  @ApiProperty({ enum: ['WALLET', 'CREDENTIALS', 'GOOGLE'], example: 'WALLET' })
  authType: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Present only for Google-authenticated accounts',
    example: '1051234567890',
  })
  googleId?: string | null;

  @ApiProperty({ example: '2026-07-31T12:00:00.000Z' })
  createdAt: Date;
}

export class SettingsResponseDto {
  @ApiProperty({ example: 'aether-crypto-v1' })
  selectedModel: string;

  @ApiProperty({ example: true })
  saveHistory: boolean;

  @ApiProperty({ example: false })
  compactSidebar: boolean;
}

export class AuthResultDto {
  @ApiProperty({
    description: 'Short-lived JWT access token (sent in body)',
    example: 'eyJhbGciOiJIUzI1NiIs...',
  })
  accessToken: string;

  @ApiProperty({ enum: ['WALLET', 'CREDENTIALS', 'GOOGLE'], example: 'WALLET' })
  authType: string;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}

export class GoogleAuthResultDto extends AuthResultDto {
  @ApiProperty({ description: 'True if this Google sign-in created a new account' })
  isNewUser: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description: "Google profile picture URL, if provided",
    example: 'https://lh3.googleusercontent.com/...',
  })
  picture?: string | null;
}

export class NonceResponseDto {
  @ApiProperty({ example: '0123...def' })
  nonce: string;

  @ApiProperty({
    description: 'The full SIWE message the wallet must sign',
    example: 'localhost wants you to sign in...',
  })
  message: string;

  @ApiProperty({ example: '2026-07-31T12:05:00.000Z' })
  expiresAt: Date;
}

export class MeResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({ enum: ['WALLET', 'CREDENTIALS', 'GOOGLE'], example: 'WALLET' })
  authType: string;

  @ApiProperty({ type: SettingsResponseDto, nullable: true })
  settings: SettingsResponseDto | null;
}

export class LogoutResponseDto {
  @ApiProperty({ example: 'Logged out' })
  message: string;
}
