import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceLocation } from '../discovery/entities/service-location.entity.js';
import { LOCAL_DEV_ISSUER, type VerifiedIdentity } from './auth/token-verifier.js';
import { Favorite } from './entities/favorite.entity.js';
import { User, UserRole } from './entities/user.entity.js';

@Injectable()
export class IdentityService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Favorite) private readonly favorites: Repository<Favorite>,
    @InjectRepository(ServiceLocation) private readonly locations: Repository<ServiceLocation>,
  ) {}

  async resolveUser(identity: VerifiedIdentity): Promise<User> {
    const localRole = resolveLocalDevRole(identity);
    await this.users
      .createQueryBuilder()
      .insert()
      .into(User)
      .values({
        issuer: identity.issuer,
        subject: identity.subject,
        displayName: identity.displayName,
        email: identity.email,
        avatarUrl: identity.avatarUrl,
        role: localRole ?? UserRole.USER,
      })
      .orIgnore()
      .execute();

    await this.users.update(
      { issuer: identity.issuer, subject: identity.subject },
      {
        displayName: identity.displayName,
        email: identity.email,
        avatarUrl: identity.avatarUrl,
        ...(localRole ? { role: localRole } : {}),
      },
    );

    return this.users.findOneByOrFail({ issuer: identity.issuer, subject: identity.subject });
  }

  toProfile(user: User) {
    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async listFavorites(userId: string) {
    const rows = await this.favorites.find({
      where: { userId },
      relations: { serviceLocation: { category: true } },
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => ({
      placeId: row.serviceLocation.id,
      name: row.serviceLocation.name,
      address: row.serviceLocation.address,
      city: row.serviceLocation.city,
      rating: Number(row.serviceLocation.rating),
      reviewCount: row.serviceLocation.reviewCount,
      category: row.serviceLocation.category
        ? { slug: row.serviceLocation.category.slug, name: row.serviceLocation.category.name }
        : null,
      createdAt: row.createdAt,
    }));
  }

  async addFavorite(userId: string, placeId: string) {
    const location = await this.locations.findOneBy({ id: placeId, isActive: true });
    if (!location) throw new NotFoundException('Place not found');

    await this.favorites.upsert(
      { userId, serviceLocationId: placeId },
      { conflictPaths: ['userId', 'serviceLocationId'], skipUpdateIfNoValuesChanged: true },
    );
    return { placeId, saved: true };
  }

  async removeFavorite(userId: string, placeId: string) {
    await this.favorites.delete({ userId, serviceLocationId: placeId });
    return { placeId, saved: false };
  }
}

function resolveLocalDevRole(identity: VerifiedIdentity): UserRole | null {
  if (identity.issuer !== LOCAL_DEV_ISSUER) return null;
  if (identity.subject === 'local-admin') return UserRole.ADMIN;
  if (identity.subject === 'local-provider') return UserRole.PROVIDER;
  return UserRole.USER;
}
