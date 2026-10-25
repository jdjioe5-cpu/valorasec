import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, mockUser } from '../../../test/test-setup';

describe('RolesGuard (Unit)', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    reflector = new Reflector();
    prisma = createPrismaMock();
    guard = new RolesGuard(reflector, prisma as unknown as PrismaService);
  });

  function createMockContext(user?: { sub: string; role?: string }): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow access if no roles are required', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const context = createMockContext({ sub: 'user-1', role: 'user' });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should allow access if user has the matching role directly', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    const context = createMockContext({ sub: 'admin-1', role: 'admin' });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should allow access if user role matches one of allowed roles (admin or auditor)', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin', 'auditor']);

    const context = createMockContext({ sub: 'auditor-1', role: 'auditor' });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should fetch role from database if not present on request.user', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    prisma.user.findUnique.mockResolvedValue(mockUser({ id: 'user-db', role: 'admin' }));

    const context = createMockContext({ sub: 'user-db' });
    const result = await guard.canActivate(context);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-db' },
      select: { role: true },
    });
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException if user does not have the required role', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    const context = createMockContext({ sub: 'user-regular', role: 'user' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if user is unauthenticated', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    const context = createMockContext(undefined);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
