import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { hash } from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';

import { AuthService } from './auth.service';

const EXISTING = {
  id: 'user-1',
  email: 'ada@example.com',
  name: 'Ada',
  dataRooms: [{ id: 'room-1', name: "Ada's Data Room", rootFolderId: 'folder-1' }],
};

interface PrismaMock {
  user: {
    findUnique: jest.Mock;
  };
  $transaction: jest.Mock;
}

function createPrismaMock(): PrismaMock {
  return {
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
}

async function createService(prisma: PrismaMock): Promise<AuthService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: PrismaService, useValue: prisma },
      { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('signed.jwt') } },
    ],
  }).compile();

  return moduleRef.get(AuthService);
}

describe('AuthService', () => {
  let prisma: PrismaMock;
  let service: AuthService;

  beforeEach(async () => {
    prisma = createPrismaMock();
    service = await createService(prisma);
  });

  describe('login', () => {
    it('returns the user and their data room on a correct password', async () => {
      const passwordHash = await hash('correct-horse', 12);
      prisma.user.findUnique.mockResolvedValue({ ...EXISTING, passwordHash });

      await expect(
        service.login({ email: EXISTING.email, password: 'correct-horse' }),
      ).resolves.toEqual({
        id: EXISTING.id,
        email: EXISTING.email,
        name: EXISTING.name,
        dataRoom: { id: 'room-1', name: "Ada's Data Room", rootFolderId: 'folder-1' },
      });
    });

    it('rejects a wrong password', async () => {
      const passwordHash = await hash('correct-horse', 12);
      prisma.user.findUnique.mockResolvedValue({ ...EXISTING, passwordHash });

      await expect(
        service.login({ email: EXISTING.email, password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('gives an unknown email the same message as a wrong password', async () => {
      const passwordHash = await hash('correct-horse', 12);

      prisma.user.findUnique.mockResolvedValue(null);
      const unknownEmail = await service
        .login({ email: 'nobody@example.com', password: 'x' })
        .catch((error: unknown) => error);

      prisma.user.findUnique.mockResolvedValue({ ...EXISTING, passwordHash });
      const wrongPassword = await service
        .login({ email: EXISTING.email, password: 'x' })
        .catch((error: unknown) => error);

      // Distinguishable messages would let anyone test which emails are registered.
      expect((unknownEmail as Error).message).toBe((wrongPassword as Error).message);
    });
  });

  describe('register', () => {
    it('stores a hash, never the password itself', async () => {
      // Captured rather than read back off `mock.calls`, which is untyped.
      let runTransaction: ((tx: unknown) => Promise<void>) | undefined;
      prisma.$transaction.mockImplementation((run: (tx: unknown) => Promise<void>) => {
        runTransaction = run;
        return Promise.resolve();
      });

      await service.register({ email: 'new@example.com', password: 'super-secret', name: 'New' });

      expect(runTransaction).toBeDefined();

      const created: { data?: { passwordHash?: string } }[] = [];
      await runTransaction?.({
        user: {
          create: (args: { data: { passwordHash: string } }) => {
            created.push(args);
            return Promise.resolve();
          },
        },
        dataRoom: { create: () => Promise.resolve(), update: () => Promise.resolve() },
        folder: { create: () => Promise.resolve() },
      });

      const passwordHash = created[0]?.data?.passwordHash ?? '';
      expect(passwordHash).toMatch(/^\$2[aby]\$/);
      expect(passwordHash).not.toContain('super-secret');
    });

    it('translates a duplicate email into a conflict', async () => {
      prisma.$transaction.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));

      await expect(
        service.register({ email: EXISTING.email, password: 'super-secret', name: 'Ada' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('does not swallow unrelated database errors', async () => {
      prisma.$transaction.mockRejectedValue(new Error('connection reset'));

      await expect(
        service.register({ email: 'new@example.com', password: 'super-secret', name: 'New' }),
      ).rejects.toThrow('connection reset');
    });
  });

  describe('findCurrentUser', () => {
    it('rejects a token whose user no longer exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.findCurrentUser({ id: 'deleted', email: 'gone@example.com' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('signAccessToken', () => {
    it('puts the user id in `sub` and nothing sensitive in the payload', async () => {
      const jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt') };
      const moduleRef = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: PrismaService, useValue: prisma },
          { provide: JwtService, useValue: jwt },
        ],
      }).compile();

      await moduleRef.get(AuthService).signAccessToken({
        id: 'user-1',
        email: 'ada@example.com',
        name: 'Ada',
        dataRoom: { id: 'room-1', name: 'r', rootFolderId: 'f' },
      });

      expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'user-1', email: 'ada@example.com' });
    });
  });
});
