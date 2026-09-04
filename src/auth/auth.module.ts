import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { getConfig } from '../config/env';
import { CookieService } from './cookie.service';
import { GoogleService } from './google.service';
import { JwtStrategy } from './jwt.strategy';
import { SiweService } from './siwe.service';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';
import { TokenService } from './token.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        secret: getConfig().jwtSecret,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    CookieService,
    SiweService,
    GoogleService,
    JwtStrategy,
    RefreshTokenStrategy,
  ],
  exports: [TokenService, AuthService],
})
export class AuthModule {}
