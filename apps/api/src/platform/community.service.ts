import { ConflictException, HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThanOrEqual, Repository } from 'typeorm';
import { ServiceLocation } from '../discovery/entities/service-location.entity.js';
import { Favorite } from '../identity/entities/favorite.entity.js';
import { User } from '../identity/entities/user.entity.js';
import { AccessService } from './access.service.js';
import {
  Contribution,
  ContributionEvidence,
  ContributionStatus,
  EmergencyContact,
  ModerationDecision,
  Notification,
  Review,
  ReviewMedia,
  ReviewStatus,
} from './entities.js';
import { FieldCryptoService } from './field-crypto.service.js';
import { StorageService } from './storage.service.js';

export interface EvidenceInput {
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
}

@Injectable()
export class CommunityService {
  constructor(
    @InjectRepository(Contribution) private readonly contributions: Repository<Contribution>,
    @InjectRepository(ContributionEvidence) private readonly evidence: Repository<ContributionEvidence>,
    @InjectRepository(ModerationDecision) private readonly decisions: Repository<ModerationDecision>,
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(ReviewMedia) private readonly reviewMedia: Repository<ReviewMedia>,
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    @InjectRepository(ServiceLocation) private readonly locations: Repository<ServiceLocation>,
    @InjectRepository(Favorite) private readonly favorites: Repository<Favorite>,
    @InjectRepository(EmergencyContact) private readonly contacts: Repository<EmergencyContact>,
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(FieldCryptoService) private readonly crypto: FieldCryptoService,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  async createContribution(
    user: User,
    input: { serviceLocationId?: string | null; kind: string; details: Record<string, unknown>; evidence?: EvidenceInput[] },
  ) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (await this.contributions.count({ where: { userId: user.id, createdAt: MoreThanOrEqual(since) } }) >= 20) {
      throw new HttpException('Daily contribution limit reached', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (input.serviceLocationId) {
      const location = await this.locations.findOneBy({ id: input.serviceLocationId, isActive: true });
      if (!location) throw new NotFoundException('Place not found');
    }
    for (const item of input.evidence ?? []) this.storage.assertOwnedObjectKey(user.id, 'contribution', item.objectKey);

    const contribution = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.getRepository(Contribution).save(
        manager.getRepository(Contribution).create({
          userId: user.id,
          serviceLocationId: input.serviceLocationId ?? null,
          kind: input.kind,
          details: input.details,
          status: ContributionStatus.PENDING,
        }),
      );
      if ((input.evidence?.length ?? 0) > 0) {
        await manager.getRepository(ContributionEvidence).save(
          input.evidence!.map((item) =>
            manager.getRepository(ContributionEvidence).create({
              contributionId: saved.id,
              objectKey: item.objectKey,
              mimeType: item.mimeType,
              sizeBytes: item.sizeBytes,
            }),
          ),
        );
      }
      return saved;
    });
    await this.access.audit(user.id, 'community.contribution.created', 'Contribution', contribution.id, { kind: contribution.kind });
    return contribution;
  }

  listMyContributions(userId: string): Promise<Contribution[]> {
    return this.contributions.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 100 });
  }

  async moderationQueue(user: User): Promise<Contribution[]> {
    this.access.requireAdmin(user);
    return this.contributions.find({ where: { status: ContributionStatus.PENDING }, order: { createdAt: 'ASC' }, take: 100 });
  }

  async moderateContribution(user: User, id: string, decision: ContributionStatus, note?: string | null) {
    this.access.requireAdmin(user);
    if (![ContributionStatus.APPROVED, ContributionStatus.REJECTED].includes(decision)) {
      throw new ConflictException('Moderation decision must approve or reject');
    }
    const result = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Contribution);
      const contribution = await repository.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!contribution) throw new NotFoundException('Contribution not found');
      if (contribution.status !== ContributionStatus.PENDING) throw new ConflictException('Contribution was already moderated');
      contribution.status = decision;
      await repository.save(contribution);
      await manager.getRepository(ModerationDecision).save(
        manager.getRepository(ModerationDecision).create({
          contributionId: id,
          moderatorUserId: user.id,
          decision,
          note: note ?? null,
        }),
      );
      await manager.getRepository(Notification).save(
        manager.getRepository(Notification).create({
          userId: contribution.userId,
          type: 'CONTRIBUTION_MODERATED',
          title: decision === ContributionStatus.APPROVED ? 'Update approved' : 'Update reviewed',
          body: decision === ContributionStatus.APPROVED ? 'Thanks for helping keep NearFind current.' : 'Your update was not published.',
          readAt: null,
        }),
      );
      return contribution;
    });
    await this.access.audit(user.id, 'community.contribution.moderated', 'Contribution', id, { decision });
    return result;
  }

  async createReview(user: User, input: { serviceLocationId: string; rating: number; comment?: string | null }) {
    const location = await this.locations.findOneBy({ id: input.serviceLocationId, isActive: true });
    if (!location) throw new NotFoundException('Place not found');
    const existing = await this.reviews.findOneBy({ userId: user.id, serviceLocationId: input.serviceLocationId });
    const review = existing ?? this.reviews.create({ userId: user.id, serviceLocationId: input.serviceLocationId });
    review.rating = input.rating;
    review.comment = input.comment ?? null;
    review.status = ReviewStatus.PUBLISHED;
    const saved = await this.reviews.save(review);
    await this.recalculateLocationRating(input.serviceLocationId);
    return saved;
  }

  listReviews(serviceLocationId: string) {
    return this.reviews.find({ where: { serviceLocationId, status: ReviewStatus.PUBLISHED }, order: { createdAt: 'DESC' }, take: 100 });
  }

  async addReviewMedia(user: User, reviewId: string, objectKey: string, mediaType: string) {
    const review = await this.reviews.findOneBy({ id: reviewId, userId: user.id });
    if (!review) throw new NotFoundException('Review not found');
    this.storage.assertOwnedObjectKey(user.id, 'review', objectKey);
    return this.reviewMedia.save(this.reviewMedia.create({ reviewId, objectKey, mediaType }));
  }

  listNotifications(userId: string): Promise<Notification[]> {
    return this.notifications.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 100 });
  }

  async markNotificationRead(userId: string, id: string): Promise<Notification> {
    const notification = await this.notifications.findOneBy({ id, userId });
    if (!notification) throw new NotFoundException('Notification not found');
    notification.readAt = notification.readAt ?? new Date();
    return this.notifications.save(notification);
  }

  async offlinePack(userId: string) {
    const [favorites, contacts] = await Promise.all([
      this.favorites.find({ where: { userId }, relations: { serviceLocation: { category: true } }, order: { createdAt: 'DESC' } }),
      this.contacts.find({ where: { userId }, order: { createdAt: 'ASC' } }),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      retention: 'Client should replace the previous offline pack on refresh and remove it on sign-out.',
      favorites: favorites.map((favorite) => ({
        id: favorite.serviceLocation.id,
        name: favorite.serviceLocation.name,
        address: favorite.serviceLocation.address,
        city: favorite.serviceLocation.city,
        category: favorite.serviceLocation.category?.name ?? null,
      })),
      emergencyContacts: contacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        relationship: contact.relationship,
        phone: this.crypto.decrypt(contact.phoneEncrypted),
      })),
    };
  }

  private async recalculateLocationRating(serviceLocationId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE service_locations sl
       SET rating = aggregate.avg_rating, review_count = aggregate.review_count
       FROM (
         SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0) AS avg_rating, COUNT(*)::int AS review_count
         FROM reviews WHERE service_location_id = $1 AND status = 'PUBLISHED'
       ) aggregate
       WHERE sl.id = $1`,
      [serviceLocationId],
    );
  }
}
