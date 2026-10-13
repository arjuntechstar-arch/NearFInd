import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceCategory } from '../discovery/entities/service-category.entity.js';
import { ServiceLocation } from '../discovery/entities/service-location.entity.js';
import { User, UserRole } from '../identity/entities/user.entity.js';
import { AccessService } from './access.service.js';
import { EmergencyContact, ProviderStatus, ServiceProvider, UserPreference, Vehicle } from './entities.js';
import { FieldCryptoService } from './field-crypto.service.js';

export interface PreferenceUpdate {
  manualLocationLabel?: string | null;
  manualLat?: number | null;
  manualLng?: number | null;
  notificationPush?: boolean;
  notificationEmail?: boolean;
  leaderboardOptIn?: boolean;
}

export interface ProviderLocationInput {
  providerId: string;
  categoryId: string;
  name: string;
  description?: string | null;
  address: string;
  city: string;
  state: string;
  countryCode: string;
  phone?: string | null;
  websiteUrl?: string | null;
  lat: number;
  lng: number;
}

@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(UserPreference) private readonly preferences: Repository<UserPreference>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(EmergencyContact) private readonly contacts: Repository<EmergencyContact>,
    @InjectRepository(ServiceProvider) private readonly providers: Repository<ServiceProvider>,
    @InjectRepository(ServiceLocation) private readonly locations: Repository<ServiceLocation>,
    @InjectRepository(ServiceCategory) private readonly categories: Repository<ServiceCategory>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject(FieldCryptoService) private readonly crypto: FieldCryptoService,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  async getPreferences(userId: string): Promise<UserPreference> {
    const existing = await this.preferences.findOneBy({ userId });
    if (existing) return existing;
    return this.preferences.save(this.preferences.create({ userId }));
  }

  async updatePreferences(userId: string, input: PreferenceUpdate): Promise<UserPreference> {
    const preference = await this.getPreferences(userId);
    const hasLat = input.manualLat !== undefined && input.manualLat !== null;
    const hasLng = input.manualLng !== undefined && input.manualLng !== null;
    if (hasLat !== hasLng) throw new ConflictException('Manual latitude and longitude must be set or cleared together');
    Object.assign(preference, {
      ...(input.manualLocationLabel !== undefined ? { manualLocationLabel: input.manualLocationLabel } : {}),
      ...(input.manualLat !== undefined ? { manualLat: input.manualLat === null ? null : String(input.manualLat) } : {}),
      ...(input.manualLng !== undefined ? { manualLng: input.manualLng === null ? null : String(input.manualLng) } : {}),
      ...(input.notificationPush !== undefined ? { notificationPush: input.notificationPush } : {}),
      ...(input.notificationEmail !== undefined ? { notificationEmail: input.notificationEmail } : {}),
      ...(input.leaderboardOptIn !== undefined ? { leaderboardOptIn: input.leaderboardOptIn } : {}),
    });
    return this.preferences.save(preference);
  }

  listVehicles(userId: string): Promise<Vehicle[]> {
    return this.vehicles.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async addVehicle(
    userId: string,
    input: { label: string; vehicleType: string; fuelType: string | null; registrationLast4: string | null; isDefault: boolean },
  ): Promise<Vehicle> {
    if (input.isDefault) await this.vehicles.update({ userId }, { isDefault: false });
    return this.vehicles.save(this.vehicles.create({ ...input, userId }));
  }

  async removeVehicle(userId: string, id: string): Promise<{ deleted: boolean }> {
    const result = await this.vehicles.delete({ id, userId });
    return { deleted: (result.affected ?? 0) > 0 };
  }

  async listEmergencyContacts(userId: string) {
    const contacts = await this.contacts.find({ where: { userId }, order: { createdAt: 'DESC' } });
    return contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      relationship: contact.relationship,
      phone: this.crypto.decrypt(contact.phoneEncrypted),
      createdAt: contact.createdAt,
    }));
  }

  async addEmergencyContact(userId: string, input: { name: string; relationship?: string | null; phone: string }) {
    const contact = await this.contacts.save(
      this.contacts.create({
        userId,
        name: input.name,
        relationship: input.relationship ?? null,
        phoneEncrypted: this.crypto.encrypt(input.phone),
      }),
    );
    return { id: contact.id, name: contact.name, relationship: contact.relationship, phone: input.phone, createdAt: contact.createdAt };
  }

  async removeEmergencyContact(userId: string, id: string): Promise<{ deleted: boolean }> {
    const result = await this.contacts.delete({ id, userId });
    return { deleted: (result.affected ?? 0) > 0 };
  }

  async createProvider(user: User, input: { name: string; supportPhone?: string | null }): Promise<ServiceProvider> {
    const provider = await this.providers.save(
      this.providers.create({
        ownerUserId: user.id,
        name: input.name,
        supportPhoneEncrypted: input.supportPhone ? this.crypto.encrypt(input.supportPhone) : null,
        status: ProviderStatus.PENDING,
      }),
    );
    await this.access.audit(user.id, 'provider.created', 'ServiceProvider', provider.id, { status: provider.status });
    return provider;
  }

  listMyProviders(userId: string): Promise<ServiceProvider[]> {
    return this.providers.find({ where: { ownerUserId: userId }, order: { createdAt: 'DESC' } });
  }

  async createProviderLocation(user: User, input: ProviderLocationInput): Promise<ServiceLocation> {
    await this.access.requireProvider(user, input.providerId);
    const category = await this.categories.findOneBy({ id: input.categoryId, isActive: true });
    if (!category) throw new NotFoundException('Category not found');
    const location = await this.locations.save(
      this.locations.create({
        providerId: input.providerId,
        categoryId: input.categoryId,
        name: input.name,
        description: input.description ?? null,
        address: input.address,
        city: input.city,
        state: input.state,
        countryCode: input.countryCode.toUpperCase(),
        phone: input.phone ?? null,
        websiteUrl: input.websiteUrl ?? null,
        location: { type: 'Point', coordinates: [input.lng, input.lat] },
        rating: '0',
        reviewCount: 0,
        isActive: true,
        version: 1,
      }),
    );
    await this.access.audit(user.id, 'provider.location.created', 'ServiceLocation', location.id, { providerId: input.providerId });
    return location;
  }

  async updateProviderLocation(
    user: User,
    id: string,
    version: number,
    input: Partial<Omit<ProviderLocationInput, 'providerId'>>,
  ): Promise<ServiceLocation> {
    const location = await this.locations.findOneBy({ id });
    if (!location || !location.providerId) throw new NotFoundException('Provider location not found');
    await this.access.requireProvider(user, location.providerId);
    if (input.categoryId) {
      const category = await this.categories.findOneBy({ id: input.categoryId, isActive: true });
      if (!category) throw new NotFoundException('Category not found');
    }
    if ((input.lat === undefined) !== (input.lng === undefined)) {
      throw new ConflictException('Latitude and longitude must be updated together');
    }
    const values: Partial<ServiceLocation> = {
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.state !== undefined ? { state: input.state } : {}),
      ...(input.countryCode !== undefined ? { countryCode: input.countryCode.toUpperCase() } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.websiteUrl !== undefined ? { websiteUrl: input.websiteUrl } : {}),
      ...(input.lat !== undefined && input.lng !== undefined
        ? { location: { type: 'Point' as const, coordinates: [input.lng, input.lat] as [number, number] } }
        : {}),
      version: version + 1,
    };
    const result = await this.locations.update({ id, version }, values);
    if ((result.affected ?? 0) !== 1) throw new ConflictException('Location was modified by another request');
    await this.access.audit(user.id, 'provider.location.updated', 'ServiceLocation', id, { previousVersion: version });
    return this.locations.findOneByOrFail({ id });
  }

  async listProviderLocations(user: User, providerId: string): Promise<ServiceLocation[]> {
    await this.access.requireProvider(user, providerId, false);
    return this.locations.find({ where: { providerId } });
  }

  async listProvidersForAdmin(user: User, status?: ProviderStatus): Promise<ServiceProvider[]> {
    this.access.requireAdmin(user);
    return this.providers.find({ where: status ? { status } : {}, order: { createdAt: 'ASC' } });
  }

  async setProviderStatus(user: User, providerId: string, status: ProviderStatus): Promise<ServiceProvider> {
    this.access.requireAdmin(user);
    const provider = await this.providers.findOneBy({ id: providerId });
    if (!provider) throw new NotFoundException('Provider not found');
    provider.status = status;
    provider.version += 1;
    const saved = await this.providers.save(provider);
    await this.users.update({ id: provider.ownerUserId }, { role: status === ProviderStatus.ACTIVE ? UserRole.PROVIDER : UserRole.USER });
    await this.access.audit(user.id, 'admin.provider.status', 'ServiceProvider', providerId, { status });
    return saved;
  }

  async createCategory(user: User, input: { slug: string; name: string; icon: string; sortOrder: number }): Promise<ServiceCategory> {
    this.access.requireAdmin(user);
    const category = await this.categories.save(this.categories.create({ ...input, slug: input.slug.toLowerCase(), isActive: true }));
    await this.access.audit(user.id, 'admin.category.created', 'ServiceCategory', category.id);
    return category;
  }

  async updateCategory(
    user: User,
    id: string,
    input: Partial<Pick<ServiceCategory, 'name' | 'icon' | 'sortOrder' | 'isActive'>>,
  ): Promise<ServiceCategory> {
    this.access.requireAdmin(user);
    const category = await this.categories.findOneBy({ id });
    if (!category) throw new NotFoundException('Category not found');
    Object.assign(category, input);
    const saved = await this.categories.save(category);
    await this.access.audit(user.id, 'admin.category.updated', 'ServiceCategory', id);
    return saved;
  }
}
