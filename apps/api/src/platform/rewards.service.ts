import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../identity/entities/user.entity.js';
import { AccessService } from './access.service.js';
import {
  Challenge,
  ChallengeProgress,
  Contribution,
  ContributionStatus,
  Perk,
  PerkRedemption,
  Review,
  ReviewStatus,
  RewardLedgerEntry,
} from './entities.js';

interface BalanceRow {
  balance: number | string;
}

interface LeaderboardRow {
  display_name: string;
  points: number | string;
}

@Injectable()
export class RewardsService {
  constructor(
    @InjectRepository(RewardLedgerEntry) private readonly ledger: Repository<RewardLedgerEntry>,
    @InjectRepository(Challenge) private readonly challenges: Repository<Challenge>,
    @InjectRepository(ChallengeProgress) private readonly progress: Repository<ChallengeProgress>,
    @InjectRepository(Perk) private readonly perks: Repository<Perk>,
    @InjectRepository(PerkRedemption) private readonly redemptions: Repository<PerkRedemption>,
    @InjectRepository(Contribution) private readonly contributions: Repository<Contribution>,
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    private readonly dataSource: DataSource,
    private readonly access: AccessService,
  ) {}

  async wallet(userId: string) {
    const row = await this.dataSource.query<BalanceRow[]>(
      'SELECT COALESCE(SUM(points), 0)::int AS balance FROM reward_ledger_entries WHERE user_id = $1',
      [userId],
    );
    const entries = await this.ledger.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 100 });
    return { balance: Number(row[0]?.balance ?? 0), entries };
  }

  async award(
    admin: User,
    input: { userId: string; points: number; sourceType: string; sourceId: string; idempotencyKey: string },
  ): Promise<RewardLedgerEntry> {
    this.access.requireAdmin(admin);
    const existing = await this.ledger.findOneBy({ idempotencyKey: input.idempotencyKey });
    if (existing) return existing;
    const entry = await this.ledger.save(this.ledger.create(input));
    await this.access.audit(admin.id, 'rewards.ledger.awarded', 'RewardLedgerEntry', entry.id, {
      targetUserId: input.userId,
      points: input.points,
      sourceType: input.sourceType,
    });
    return entry;
  }

  async syncChallenges(user: User) {
    const active = await this.challenges.find({ where: { isActive: true }, order: { createdAt: 'ASC' } });
    const [approvedContributions, publishedReviews] = await Promise.all([
      this.contributions.count({ where: { userId: user.id, status: ContributionStatus.APPROVED } }),
      this.reviews.count({ where: { userId: user.id, status: ReviewStatus.PUBLISHED } }),
    ]);

    for (const challenge of active) {
      const value = challenge.targetType === 'CONTRIBUTION' ? approvedContributions : publishedReviews;
      let item = await this.progress.findOneBy({ userId: user.id, challengeId: challenge.id });
      item ??= this.progress.create({ userId: user.id, challengeId: challenge.id, progress: 0, completedAt: null });
      item.progress = Math.min(value, challenge.targetCount);
      const newlyCompleted = item.completedAt === null && item.progress >= challenge.targetCount;
      if (newlyCompleted) item.completedAt = new Date();
      await this.progress.save(item);
      if (newlyCompleted) {
        await this.ledger
          .createQueryBuilder()
          .insert()
          .into(RewardLedgerEntry)
          .values({
            userId: user.id,
            points: challenge.rewardPoints,
            sourceType: 'CHALLENGE',
            sourceId: challenge.id,
            idempotencyKey: `challenge:${user.id}:${challenge.id}`,
          })
          .orIgnore()
          .execute();
      }
    }

    const progress = await this.progress.find({ where: { userId: user.id } });
    const byChallenge = new Map(progress.map((item) => [item.challengeId, item]));
    return active.map((challenge) => ({ ...challenge, progress: byChallenge.get(challenge.id)?.progress ?? 0, completedAt: byChallenge.get(challenge.id)?.completedAt ?? null }));
  }

  listPerks(): Promise<Perk[]> {
    return this.perks.find({ where: { isActive: true }, order: { costPoints: 'ASC' } });
  }

  async redeem(user: User, perkId: string, idempotencyKey: string) {
    return this.dataSource.transaction(async (manager) => {
      const redemptionRepo = manager.getRepository(PerkRedemption);
      const existing = await redemptionRepo.findOneBy({ userId: user.id, idempotencyKey });
      if (existing) return existing;
      const perkRepo = manager.getRepository(Perk);
      const perk = await perkRepo.findOne({ where: { id: perkId }, lock: { mode: 'pessimistic_write' } });
      if (!perk || !perk.isActive) throw new NotFoundException('Perk not found');
      if (perk.stock <= 0) throw new ConflictException('Perk is out of stock');
      const row = await manager.query<BalanceRow[]>(
        'SELECT COALESCE(SUM(points), 0)::int AS balance FROM reward_ledger_entries WHERE user_id = $1',
        [user.id],
      );
      const balance = Number(row[0]?.balance ?? 0);
      if (balance < perk.costPoints) throw new ConflictException('Insufficient reward points');
      perk.stock -= 1;
      await perkRepo.save(perk);
      const redemption = await redemptionRepo.save(
        redemptionRepo.create({
          userId: user.id,
          perkId,
          pointsSpent: perk.costPoints,
          status: 'CONFIRMED',
          idempotencyKey,
        }),
      );
      await manager.getRepository(RewardLedgerEntry).save(
        manager.getRepository(RewardLedgerEntry).create({
          userId: user.id,
          points: -perk.costPoints,
          sourceType: 'PERK_REDEMPTION',
          sourceId: redemption.id,
          idempotencyKey: `redeem:${user.id}:${idempotencyKey}`,
        }),
      );
      return redemption;
    });
  }

  async leaderboard() {
    const rows = await this.dataSource.query<LeaderboardRow[]>(
      `SELECT COALESCE(u.display_name, 'NearFind user') AS display_name, COALESCE(SUM(l.points), 0)::int AS points
       FROM users u
       JOIN user_preferences p ON p.user_id = u.id AND p.leaderboard_opt_in = true
       JOIN reward_ledger_entries l ON l.user_id = u.id
       GROUP BY u.id, u.display_name
       HAVING SUM(l.points) > 0
       ORDER BY points DESC
       LIMIT 100`,
    );
    return rows.map((row, index) => ({ rank: index + 1, displayName: row.display_name, points: Number(row.points) }));
  }

  async createPerk(admin: User, input: { name: string; description?: string | null; costPoints: number; stock: number }): Promise<Perk> {
    this.access.requireAdmin(admin);
    const perk = await this.perks.save(this.perks.create({ ...input, description: input.description ?? null, isActive: true }));
    await this.access.audit(admin.id, 'rewards.perk.created', 'Perk', perk.id);
    return perk;
  }

  async createChallenge(
    admin: User,
    input: { name: string; targetType: string; targetCount: number; rewardPoints: number },
  ): Promise<Challenge> {
    this.access.requireAdmin(admin);
    if (!['CONTRIBUTION', 'REVIEW'].includes(input.targetType)) throw new ConflictException('Unsupported challenge target');
    const challenge = await this.challenges.save(this.challenges.create({ ...input, isActive: true }));
    await this.access.audit(admin.id, 'rewards.challenge.created', 'Challenge', challenge.id);
    return challenge;
  }
}
