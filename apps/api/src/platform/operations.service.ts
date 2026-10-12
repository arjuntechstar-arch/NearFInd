import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../identity/entities/user.entity.js';
import { AccessService } from './access.service.js';
import { AuditEvent, FeatureFlag } from './entities.js';
import { StorageService } from './storage.service.js';

@Injectable()
export class OperationsService {
  constructor(
    @InjectRepository(FeatureFlag) private readonly flags: Repository<FeatureFlag>,
    @InjectRepository(AuditEvent) private readonly audits: Repository<AuditEvent>,
    private readonly storage: StorageService,
    private readonly access: AccessService,
  ) {}

  createUploadIntent(user: User, purpose: string, mimeType: string, sizeBytes: number) {
    return this.storage.createUploadIntent(user.id, purpose, mimeType, sizeBytes);
  }

  async listFeatureFlags(user: User): Promise<FeatureFlag[]> {
    this.access.requireAdmin(user);
    return this.flags.find({ order: { key: 'ASC' } });
  }

  async setFeatureFlag(user: User, key: string, enabled: boolean, config: Record<string, unknown>): Promise<FeatureFlag> {
    this.access.requireAdmin(user);
    let flag = await this.flags.findOneBy({ key });
    flag ??= this.flags.create({ key, enabled: false, config: {} });
    flag.enabled = enabled;
    flag.config = config;
    const saved = await this.flags.save(flag);
    await this.access.audit(user.id, 'admin.feature_flag.updated', 'FeatureFlag', key, { enabled });
    return saved;
  }

  async listAuditEvents(user: User, limit: number): Promise<AuditEvent[]> {
    this.access.requireAdmin(user);
    return this.audits.find({ order: { createdAt: 'DESC' }, take: limit });
  }

  async getFeatureFlag(key: string): Promise<FeatureFlag> {
    const flag = await this.flags.findOneBy({ key });
    if (!flag) throw new NotFoundException('Feature flag not found');
    return flag;
  }
}
