import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService, SafeUser, UserSettingsSummary } from '../auth/auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async create(input: CreateUserDto): Promise<SafeUser> {
    const data: Prisma.UserCreateInput = {
      email: input.email,
      username: input.username ?? null,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      role: input.role ?? 'USER',
      tier: input.tier ?? 'FREE',
    };
    if (input.password) {
      data.passwordHash = await bcrypt.hash(input.password, 10);
    }
    try {
      const user = await this.prisma.user.create({ data });
      return this.toSafeUser(user);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Email or username already in use');
      }
      throw error;
    }
  }

  findAll(): Promise<SafeUser[]> {
    return this.prisma.user
      .findMany({ orderBy: { createdAt: 'desc' } })
      .then((users) => users.map((u) => this.toSafeUser(u)));
  }

  async findOne(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return this.toSafeUser(user);
  }

  async update(id: string, input: UpdateUserDto): Promise<SafeUser> {
    await this.findOne(id);
    const data: Prisma.UserUpdateInput = {};
    if (input.email !== undefined) data.email = input.email;
    if (input.username !== undefined) data.username = input.username;
    if (input.firstName !== undefined) data.firstName = input.firstName;
    if (input.lastName !== undefined) data.lastName = input.lastName;
    if (input.role !== undefined) data.role = input.role;
    if (input.tier !== undefined) data.tier = input.tier;
    if (input.password !== undefined) {
      data.passwordHash = await bcrypt.hash(input.password, 10);
    }
    try {
      const user = await this.prisma.user.update({ where: { id }, data });
      return this.toSafeUser(user);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Email or username already in use');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    return { id };
  }

  async getMe(userId: string, authType: SafeUser['authType']) {
    return this.authService.me(userId, authType);
  }

  updateMyProfile(userId: string, input: UpdateProfileDto): Promise<SafeUser> {
    return this.authService.updateProfile(userId, input);
  }

  updateMySettings(
    userId: string,
    input: UpdateSettingsDto,
  ): Promise<UserSettingsSummary> {
    return this.authService.updateSettings(userId, input);
  }

  private toSafeUser(user: User): SafeUser {
    const authType: SafeUser['authType'] = user.googleId
      ? 'GOOGLE'
      : user.address
        ? 'WALLET'
        : 'CREDENTIALS';
    return this.authService.toSafeUser(user, authType);
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }
}
