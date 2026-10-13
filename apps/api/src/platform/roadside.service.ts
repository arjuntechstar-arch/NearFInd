import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, MoreThanOrEqual, Repository } from 'typeorm';
import { User, UserRole } from '../identity/entities/user.entity.js';
import { AccessService } from './access.service.js';
import {
  ChatMessage,
  DispatchAssignment,
  DispatchEvent,
  DispatchRequest,
  DispatchStatus,
  LiveLocationGrant,
  ProviderStatus,
  ServiceProvider,
  Vehicle,
} from './entities.js';
import { FieldCryptoService } from './field-crypto.service.js';
import { StorageService } from './storage.service.js';

export function canTransitionDispatch(from: DispatchStatus, to: DispatchStatus): boolean {
  const transitions: Record<DispatchStatus, readonly DispatchStatus[]> = {
    [DispatchStatus.REQUESTED]: [DispatchStatus.TRIAGED, DispatchStatus.CANCELLED],
    [DispatchStatus.TRIAGED]: [DispatchStatus.ASSIGNED, DispatchStatus.CANCELLED],
    [DispatchStatus.ASSIGNED]: [DispatchStatus.EN_ROUTE, DispatchStatus.CANCELLED],
    [DispatchStatus.EN_ROUTE]: [DispatchStatus.ARRIVED, DispatchStatus.CANCELLED],
    [DispatchStatus.ARRIVED]: [DispatchStatus.COMPLETED, DispatchStatus.CANCELLED],
    [DispatchStatus.COMPLETED]: [],
    [DispatchStatus.CANCELLED]: [],
  };
  return transitions[from].includes(to);
}

@Injectable()
export class RoadsideService {
  constructor(
    @InjectRepository(DispatchRequest) private readonly requests: Repository<DispatchRequest>,
    @InjectRepository(DispatchAssignment) private readonly assignments: Repository<DispatchAssignment>,
    @InjectRepository(DispatchEvent) private readonly events: Repository<DispatchEvent>,
    @InjectRepository(LiveLocationGrant) private readonly grants: Repository<LiveLocationGrant>,
    @InjectRepository(ChatMessage) private readonly messages: Repository<ChatMessage>,
    @InjectRepository(ServiceProvider) private readonly providers: Repository<ServiceProvider>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(FieldCryptoService) private readonly crypto: FieldCryptoService,
    @Inject(StorageService) private readonly storage: StorageService,
  ) {}

  async createRequest(
    user: User,
    input: {
      vehicleId?: string | null;
      serviceType: string;
      lat: number;
      lng: number;
      notes?: string | null;
      idempotencyKey: string;
    },
  ) {
    const existing = await this.requests.findOneBy({ userId: user.id, idempotencyKey: input.idempotencyKey });
    if (existing) return this.toDispatchView(user, existing);
    const since = new Date(Date.now() - 60 * 60 * 1000);
    if (await this.requests.count({ where: { userId: user.id, createdAt: MoreThanOrEqual(since) } }) >= 5) {
      throw new HttpException('Roadside request limit reached', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (input.vehicleId && !(await this.vehicles.findOneBy({ id: input.vehicleId, userId: user.id }))) {
      throw new NotFoundException('Vehicle not found');
    }
    const request = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.getRepository(DispatchRequest).save(
        manager.getRepository(DispatchRequest).create({
          userId: user.id,
          vehicleId: input.vehicleId ?? null,
          serviceType: input.serviceType,
          status: DispatchStatus.REQUESTED,
          locationEncrypted: this.crypto.encrypt(JSON.stringify({ lat: input.lat, lng: input.lng })),
          notesEncrypted: input.notes ? this.crypto.encrypt(input.notes) : null,
          idempotencyKey: input.idempotencyKey,
        }),
      );
      await this.addEvent(manager, saved.id, user.id, 'REQUESTED', { serviceType: input.serviceType });
      return saved;
    });
    await this.access.audit(user.id, 'roadside.request.created', 'DispatchRequest', request.id, { serviceType: request.serviceType });
    return this.toDispatchView(user, request);
  }

  async listMine(user: User) {
    const rows = await this.requests.find({ where: { userId: user.id }, order: { createdAt: 'DESC' }, take: 100 });
    return Promise.all(rows.map((request) => this.toDispatchView(user, request)));
  }

  async getRequest(user: User, id: string) {
    const request = await this.requireDispatchAccess(user, id);
    return this.toDispatchView(user, request);
  }

  async listQueue(user: User): Promise<DispatchRequest[]> {
    this.access.requireAdmin(user);
    return this.requests
      .createQueryBuilder('request')
      .where('request.status IN (:...statuses)', { statuses: [DispatchStatus.REQUESTED, DispatchStatus.TRIAGED, DispatchStatus.ASSIGNED] })
      .orderBy('request.created_at', 'ASC')
      .limit(100)
      .getMany();
  }

  async triage(user: User, id: string): Promise<DispatchRequest> {
    this.access.requireAdmin(user);
    return this.transition(user, id, DispatchStatus.TRIAGED);
  }

  async assign(user: User, id: string, providerId: string): Promise<DispatchRequest> {
    this.access.requireAdmin(user);
    const provider = await this.providers.findOneBy({ id: providerId, status: ProviderStatus.ACTIVE });
    if (!provider) throw new NotFoundException('Active provider not found');
    const request = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(DispatchRequest);
      const dispatch = await repository.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!dispatch) throw new NotFoundException('Roadside request not found');
      if (dispatch.status === DispatchStatus.REQUESTED) dispatch.status = DispatchStatus.TRIAGED;
      if (!canTransitionDispatch(dispatch.status, DispatchStatus.ASSIGNED)) throw new ConflictException('Roadside request cannot be assigned');
      const existing = await manager.getRepository(DispatchAssignment).findOneBy({ dispatchRequestId: id });
      if (existing && existing.providerId !== providerId) throw new ConflictException('Roadside request is already assigned');
      if (!existing) {
        await manager.getRepository(DispatchAssignment).save(
          manager.getRepository(DispatchAssignment).create({ dispatchRequestId: id, providerId, assignedByUserId: user.id }),
        );
      }
      dispatch.status = DispatchStatus.ASSIGNED;
      await repository.save(dispatch);
      await this.addEvent(manager, id, user.id, 'ASSIGNED', { providerId });
      return dispatch;
    });
    await this.access.audit(user.id, 'roadside.request.assigned', 'DispatchRequest', id, { providerId });
    return request;
  }

  async updateStatus(user: User, id: string, status: DispatchStatus): Promise<DispatchRequest> {
    const request = await this.requests.findOneBy({ id });
    if (!request) throw new NotFoundException('Roadside request not found');
    if (status === DispatchStatus.CANCELLED) {
      if (request.userId !== user.id && user.role !== UserRole.ADMIN) throw new ForbiddenException('Only the requester or admin can cancel');
    } else if (user.role !== UserRole.ADMIN) {
      const assignment = await this.assignments.findOneBy({ dispatchRequestId: id });
      if (!assignment || !(await this.access.isProviderOwner(user, assignment.providerId))) {
        throw new ForbiddenException('Assigned provider access required');
      }
    }
    return this.transition(user, id, status);
  }

  async createLocationGrant(user: User, id: string, ttlMinutes: number): Promise<LiveLocationGrant> {
    const request = await this.requests.findOneBy({ id });
    if (!request) throw new NotFoundException('Roadside request not found');
    if (request.userId !== user.id) throw new ForbiddenException('Only the requester can grant live location');
    if ([DispatchStatus.CANCELLED, DispatchStatus.COMPLETED].includes(request.status)) throw new ConflictException('Roadside request is closed');
    const grant = await this.grants.save(
      this.grants.create({
        dispatchRequestId: id,
        userId: user.id,
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
        revokedAt: null,
        locationEncrypted: null,
      }),
    );
    await this.access.audit(user.id, 'roadside.location.granted', 'LiveLocationGrant', grant.id, { ttlMinutes });
    return grant;
  }

  async updateLiveLocation(user: User, id: string, grantId: string, lat: number, lng: number): Promise<{ updated: true }> {
    const grant = await this.grants.findOneBy({ id: grantId, dispatchRequestId: id, userId: user.id });
    if (!grant || grant.revokedAt || grant.expiresAt <= new Date()) throw new ForbiddenException('Live-location grant is inactive');
    grant.locationEncrypted = this.crypto.encrypt(JSON.stringify({ lat, lng }));
    await this.grants.save(grant);
    return { updated: true };
  }

  async getLiveLocation(user: User, id: string) {
    await this.requireDispatchAccess(user, id);
    const grant = await this.grants
      .createQueryBuilder('grant')
      .where('grant.dispatch_request_id = :id', { id })
      .andWhere('grant.revoked_at IS NULL')
      .andWhere('grant.expires_at > now()')
      .andWhere('grant.location_encrypted IS NOT NULL')
      .orderBy('grant.updated_at', 'DESC')
      .getOne();
    return grant?.locationEncrypted
      ? { grantId: grant.id, expiresAt: grant.expiresAt, location: JSON.parse(this.crypto.decrypt(grant.locationEncrypted)) as unknown }
      : null;
  }

  async revokeLocationGrant(user: User, id: string, grantId: string): Promise<{ revoked: true }> {
    const request = await this.requests.findOneBy({ id });
    if (!request) throw new NotFoundException('Roadside request not found');
    if (request.userId !== user.id && user.role !== UserRole.ADMIN) throw new ForbiddenException('Location grant access denied');
    const grant = await this.grants.findOneBy({ id: grantId, dispatchRequestId: id });
    if (!grant) throw new NotFoundException('Live-location grant not found');
    grant.revokedAt = grant.revokedAt ?? new Date();
    await this.grants.save(grant);
    await this.access.audit(user.id, 'roadside.location.revoked', 'LiveLocationGrant', grantId);
    return { revoked: true };
  }

  async sendMessage(user: User, id: string, input: { body?: string | null; attachmentObjectKey?: string | null }) {
    await this.requireDispatchAccess(user, id);
    if (!input.body && !input.attachmentObjectKey) throw new ConflictException('Message body or attachment is required');
    if (input.attachmentObjectKey) this.storage.assertOwnedObjectKey(user.id, 'chat', input.attachmentObjectKey);
    return this.messages.save(
      this.messages.create({
        dispatchRequestId: id,
        senderUserId: user.id,
        body: input.body ?? null,
        attachmentObjectKey: input.attachmentObjectKey ?? null,
      }),
    );
  }

  async listMessages(user: User, id: string): Promise<ChatMessage[]> {
    await this.requireDispatchAccess(user, id);
    return this.messages.find({ where: { dispatchRequestId: id }, order: { createdAt: 'ASC' }, take: 500 });
  }

  async listEvents(user: User, id: string): Promise<DispatchEvent[]> {
    await this.requireDispatchAccess(user, id);
    return this.events.find({ where: { dispatchRequestId: id }, order: { createdAt: 'ASC' }, take: 200 });
  }

  private async transition(user: User, id: string, next: DispatchStatus): Promise<DispatchRequest> {
    const updated = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(DispatchRequest);
      const request = await repository.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!request) throw new NotFoundException('Roadside request not found');
      if (request.status === next) return request;
      if (!canTransitionDispatch(request.status, next)) throw new ConflictException(`Cannot transition ${request.status} to ${next}`);
      const previous = request.status;
      request.status = next;
      await repository.save(request);
      await this.addEvent(manager, id, user.id, 'STATUS_CHANGED', { from: previous, to: next });
      return request;
    });
    await this.access.audit(user.id, 'roadside.request.status', 'DispatchRequest', id, { status: next });
    return updated;
  }

  private async requireDispatchAccess(user: User, id: string): Promise<DispatchRequest> {
    const request = await this.requests.findOneBy({ id });
    if (!request) throw new NotFoundException('Roadside request not found');
    if (request.userId === user.id || user.role === UserRole.ADMIN) return request;
    const assignment = await this.assignments.findOneBy({ dispatchRequestId: id });
    if (assignment && (await this.access.isProviderOwner(user, assignment.providerId))) return request;
    throw new ForbiddenException('Roadside request access denied');
  }

  private async toDispatchView(user: User, request: DispatchRequest) {
    await this.requireDispatchAccess(user, request.id);
    const assignment = await this.assignments.findOneBy({ dispatchRequestId: request.id });
    return {
      id: request.id,
      serviceType: request.serviceType,
      status: request.status,
      vehicleId: request.vehicleId,
      startLocation: JSON.parse(this.crypto.decrypt(request.locationEncrypted)) as unknown,
      notes: request.notesEncrypted ? this.crypto.decrypt(request.notesEncrypted) : null,
      assignedProviderId: assignment?.providerId ?? null,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  private async addEvent(
    manager: EntityManager,
    dispatchRequestId: string,
    actorUserId: string | null,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await manager.getRepository(DispatchEvent).save(
      manager.getRepository(DispatchEvent).create({ dispatchRequestId, actorUserId, type, payload }),
    );
  }
}
