import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.sub) {
      throw new ForbiddenException('Access denied: unauthenticated');
    }

    let role = user.role;
    if (!role) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.sub },
        select: { role: true },
      });
      role = dbUser?.role;
      user.role = role;
    }

    if (!role || !requiredRoles.includes(role)) {
      throw new ForbiddenException(
        `Forbidden resource: user role '${role || 'unknown'}' does not have required permissions [${requiredRoles.join(', ')}]`,
      );
    }

    return true;
  }
}
