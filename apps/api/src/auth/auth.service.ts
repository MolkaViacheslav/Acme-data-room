import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash, hashSync } from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';

import type { Actor, AuthUser, JwtPayload } from './auth.types';
import { createUserWithDataRoom } from './create-user-with-data-room';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

const PASSWORD_SALT_ROUNDS = 12;

/**
 * Compared against when no user matched, so a wrong email costs the same time
 * as a wrong password and the response cannot be used to enumerate accounts.
 */
const ABSENT_USER_HASH = hashSync('there-is-no-such-user', PASSWORD_SALT_ROUNDS);

/** Postgres unique-constraint violation, as surfaced by Prisma. */
function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

interface UserWithDataRooms {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly dataRooms: readonly { id: string; name: string; rootFolderId: string | null }[];
}

function toAuthUser(user: UserWithDataRooms): AuthUser {
  const dataRoom = user.dataRooms[0];

  // Registration creates both in one transaction, so this is unreachable
  // unless someone has edited the database by hand.
  if (dataRoom === undefined || dataRoom.rootFolderId === null) {
    throw new InternalServerErrorException('This account has no usable data room.');
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    dataRoom: { id: dataRoom.id, name: dataRoom.name, rootFolderId: dataRoom.rootFolderId },
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthUser> {
    const passwordHash = await hash(dto.password, PASSWORD_SALT_ROUNDS);

    try {
      return await createUserWithDataRoom(this.prisma, {
        email: dto.email,
        name: dto.name,
        passwordHash,
      });
    } catch (error) {
      // Two simultaneous registrations race past any pre-check, so the unique
      // index is what actually decides — this translates its complaint.
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException('An account with this email already exists.');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthUser> {
    const user = await this.findUserByEmail(dto.email);
    const passwordMatches = await compare(dto.password, user?.passwordHash ?? ABSENT_USER_HASH);

    // One message for both failures: which of the two was wrong is not the
    // caller's business.
    if (user === null || !passwordMatches) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }

    return toAuthUser(user);
  }

  async findCurrentUser(actor: Actor): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: {
        id: true,
        email: true,
        name: true,
        dataRooms: {
          select: { id: true, name: true, rootFolderId: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    // A valid token for a user that no longer exists — deleted account.
    if (user === null) {
      throw new UnauthorizedException('Your session is no longer valid.');
    }

    return toAuthUser(user);
  }

  signAccessToken(user: AuthUser): Promise<string> {
    const payload: JwtPayload = { sub: user.id, email: user.email };

    return this.jwt.signAsync(payload);
  }

  private findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        dataRooms: {
          select: { id: true, name: true, rootFolderId: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });
  }
}
