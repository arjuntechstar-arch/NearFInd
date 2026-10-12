import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../identity/entities/user.entity.js';
import { AuditEvent, ProviderStatus, ServiceProvider } from './entities.js';

@Injectable()
export class AccessService {
  constructor(
    @InjectRepository(ServiceProvider) private readonly providers: Repository<ServiceProvider>,
    @InjectRepository(AuditEvent) private readonly audits: Repository<AuditEvent>,
  ) {}

  requireAdmin(user: User): void {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException('Administrator role required');
  }

  async requireProvider(user: User, providerId: string, activeOnly = true): Promise<ServiceProvider> {
    const provider = await this.providers.findOneBy({ id: providerId });
    if (!provider) throw new NotFoundException('Provider not found');
    if (user.role !== UserRole.ADMIN && provider.ownerUserId !== user.id) {
      throw new ForbiddenException('Provider ownership required');
    }
    if (activeOnly && provider.status !== ProviderStatus.ACTIVE) {
      throw new ForbiddenException('Provider is not active');
    }
    return provider;
  }

  async isProviderOwner(user: User, providerId: string): Promise<boolean> {
    if (user.role === UserRole.ADMIN) return true;
    return (await this.providers.countBy({ id: providerId, ownerUserId: user.id })) === 1;
  }

  async audit(
    actorUserId: string | null,
    action: string,
    resourceType: string,
    resourceId: string | null,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await this.audits.save(this.audits.create({ actorUserId, action, resourceType, resourceId, metadata }));
  }
}
