import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleTokenDto {
  @ApiProperty({
    description:
      'The short-lived (120s) signed login ticket received from the redirect callback (?ticket=...)',
    example: 'eyJzdWIiOiJ1c2VyLTEiLCJwdXJwb3NlIjoiZ29vZ2xlLWxvZ2luIiw...',
  })
  @IsString()
  @IsNotEmpty()
  ticket: string;
}
