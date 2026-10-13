import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, type EntityManager, In, LessThan, Repository } from 'typeorm';
import { ServiceLocation } from '../discovery/entities/service-location.entity.js';
import { User } from '../identity/entities/user.entity.js';
import { AccessService } from './access.service.js';
import { Booking, BookingStatus, PaymentReference, PaymentStatus, ProviderSlot } from './entities.js';

export function canTransitionBooking(from: BookingStatus, to: BookingStatus): boolean {
  const allowed: Record<BookingStatus, readonly BookingStatus[]> = {
    [BookingStatus.RESERVED]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
    [BookingStatus.CONFIRMED]: [BookingStatus.CANCELLED, BookingStatus.COMPLETED],
    [BookingStatus.CANCELLED]: [],
    [BookingStatus.COMPLETED]: [],
  };
  return allowed[from].includes(to);
}

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(ProviderSlot) private readonly slots: Repository<ProviderSlot>,
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(PaymentReference) private readonly payments: Repository<PaymentReference>,
    @InjectRepository(ServiceLocation) private readonly locations: Repository<ServiceLocation>,
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  async createSlot(
    user: User,
    input: {
      providerId: string;
      serviceLocationId: string;
      startsAt: Date;
      endsAt: Date;
      capacity: number;
      priceMinor: number;
      currency: string;
    },
  ): Promise<ProviderSlot> {
    await this.access.requireProvider(user, input.providerId);
    const location = await this.locations.findOneBy({ id: input.serviceLocationId, providerId: input.providerId });
    if (!location) throw new NotFoundException('Provider location not found');
    if (input.startsAt <= new Date() || input.endsAt <= input.startsAt) throw new ConflictException('Slot must be a future valid time window');
    const slot = await this.slots.save(
      this.slots.create({
        providerId: input.providerId,
        serviceLocationId: input.serviceLocationId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        capacity: input.capacity,
        bookedCount: 0,
        priceMinor: input.priceMinor,
        currency: input.currency.toUpperCase(),
        version: 1,
      }),
    );
    await this.access.audit(user.id, 'booking.slot.created', 'ProviderSlot', slot.id, { providerId: slot.providerId });
    return slot;
  }

  async updateSlot(
    user: User,
    id: string,
    version: number,
    input: { capacity?: number; priceMinor?: number },
  ): Promise<ProviderSlot> {
    const slot = await this.slots.findOneBy({ id });
    if (!slot) throw new NotFoundException('Slot not found');
    await this.access.requireProvider(user, slot.providerId);
    const capacity = input.capacity ?? slot.capacity;
    if (capacity < slot.bookedCount) throw new ConflictException('Capacity cannot be lower than active bookings');
    const result = await this.slots.update(
      { id, version },
      {
        ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
        ...(input.priceMinor !== undefined ? { priceMinor: input.priceMinor } : {}),
        version: version + 1,
      },
    );
    if ((result.affected ?? 0) !== 1) throw new ConflictException('Slot was modified by another request');
    return this.slots.findOneByOrFail({ id });
  }

  listSlots(serviceLocationId: string): Promise<ProviderSlot[]> {
    return this.slots
      .createQueryBuilder('slot')
      .where('slot.service_location_id = :serviceLocationId', { serviceLocationId })
      .andWhere('slot.starts_at > now()')
      .orderBy('slot.starts_at', 'ASC')
      .limit(100)
      .getMany();
  }

  async reserve(user: User, slotId: string, idempotencyKey: string): Promise<Booking> {
    return this.dataSource.transaction(async (manager) => {
      const bookingRepo = manager.getRepository(Booking);
      const existing = await bookingRepo.findOneBy({ userId: user.id, idempotencyKey });
      if (existing) return existing;

      const slotRepo = manager.getRepository(ProviderSlot);
      const slot = await slotRepo.findOne({ where: { id: slotId }, lock: { mode: 'pessimistic_write' } });
      if (!slot) throw new NotFoundException('Slot not found');
      await this.releaseExpiredReservations(manager, slot);
      if (slot.startsAt <= new Date()) throw new ConflictException('Slot has already started');
      if (slot.bookedCount >= slot.capacity) throw new ConflictException('Booking slot is no longer available');
      slot.bookedCount += 1;
      slot.version += 1;
      await slotRepo.save(slot);
      return bookingRepo.save(
        bookingRepo.create({
          userId: user.id,
          slotId: slot.id,
          providerId: slot.providerId,
          serviceLocationId: slot.serviceLocationId,
          status: BookingStatus.RESERVED,
          idempotencyKey,
          amountMinor: slot.priceMinor,
          currency: slot.currency,
          holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        }),
      );
    });
  }

  async authorizeSandboxPayment(
    user: User,
    bookingId: string,
    paymentMethodToken: string,
    idempotencyKey: string,
  ) {
    if (!paymentMethodToken.startsWith('sandbox_pm_') || paymentMethodToken.length > 256) {
      throw new ConflictException('Only an opaque sandbox payment token is accepted');
    }
    const result = await this.dataSource.transaction(async (manager) => {
      const bookingRepo = manager.getRepository(Booking);
      const paymentRepo = manager.getRepository(PaymentReference);
      const booking = await bookingRepo.findOne({ where: { id: bookingId }, lock: { mode: 'pessimistic_write' } });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.userId !== user.id) throw new ForbiddenException('Booking ownership required');
      const existingPayment = await paymentRepo.findOneBy({ bookingId, idempotencyKey });
      if (existingPayment) return { booking, payment: existingPayment };
      if (booking.status !== BookingStatus.RESERVED) throw new ConflictException('Booking is not awaiting payment');
      if (booking.holdExpiresAt <= new Date()) {
        await this.cancelLockedBooking(manager, booking);
        throw new ConflictException('Booking reservation expired');
      }
      const payment = await paymentRepo.save(
        paymentRepo.create({
          bookingId,
          provider: 'SANDBOX',
          externalRef: `sandbox_pay_${randomUUID()}`,
          idempotencyKey,
          status: PaymentStatus.AUTHORIZED,
          amountMinor: booking.amountMinor,
          currency: booking.currency,
        }),
      );
      booking.status = BookingStatus.CONFIRMED;
      await bookingRepo.save(booking);
      return { booking, payment };
    });
    await this.access.audit(user.id, 'booking.payment.authorized', 'Booking', bookingId, { provider: 'SANDBOX' });
    return result;
  }

  async cancel(user: User, bookingId: string): Promise<Booking> {
    const booking = await this.bookings.findOneBy({ id: bookingId });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== user.id && !(await this.access.isProviderOwner(user, booking.providerId))) {
      throw new ForbiddenException('Booking access denied');
    }
    const cancelled = await this.dataSource.transaction(async (manager) => {
      const locked = await manager.getRepository(Booking).findOne({ where: { id: bookingId }, lock: { mode: 'pessimistic_write' } });
      if (!locked) throw new NotFoundException('Booking not found');
      if (locked.status === BookingStatus.CANCELLED) return locked;
      if (!canTransitionBooking(locked.status, BookingStatus.CANCELLED)) throw new ConflictException('Booking can no longer be cancelled');
      return this.cancelLockedBooking(manager, locked);
    });
    await this.access.audit(user.id, 'booking.cancelled', 'Booking', bookingId);
    return cancelled;
  }

  async complete(user: User, bookingId: string): Promise<Booking> {
    const booking = await this.bookings.findOneBy({ id: bookingId });
    if (!booking) throw new NotFoundException('Booking not found');
    await this.access.requireProvider(user, booking.providerId);
    if (!canTransitionBooking(booking.status, BookingStatus.COMPLETED)) throw new ConflictException('Booking cannot be completed');
    booking.status = BookingStatus.COMPLETED;
    const saved = await this.bookings.save(booking);
    await this.access.audit(user.id, 'booking.completed', 'Booking', bookingId);
    return saved;
  }

  async getBooking(user: User, id: string): Promise<Booking> {
    const booking = await this.bookings.findOneBy({ id });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== user.id && !(await this.access.isProviderOwner(user, booking.providerId))) {
      throw new ForbiddenException('Booking access denied');
    }
    return booking;
  }

  async listMyBookings(userId: string): Promise<Booking[]> {
    return this.bookings.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 100 });
  }

  async listProviderBookings(user: User, providerId: string): Promise<Booking[]> {
    await this.access.requireProvider(user, providerId, false);
    return this.bookings.find({ where: { providerId }, order: { createdAt: 'DESC' }, take: 200 });
  }

  async receipt(user: User, bookingId: string) {
    const booking = await this.getBooking(user, bookingId);
    const payment = await this.payments.findOne({ where: { bookingId }, order: { createdAt: 'DESC' } });
    return {
      receiptId: payment?.externalRef ?? null,
      bookingId,
      status: booking.status,
      paymentStatus: payment?.status ?? null,
      amountMinor: booking.amountMinor,
      currency: booking.currency,
      issuedAt: payment?.createdAt ?? booking.createdAt,
    };
  }

  private async releaseExpiredReservations(manager: EntityManager, slot: ProviderSlot): Promise<void> {
    const expired = await manager.getRepository(Booking).find({
      where: { slotId: slot.id, status: BookingStatus.RESERVED, holdExpiresAt: LessThan(new Date()) },
    });
    if (expired.length === 0) return;
    await manager.getRepository(Booking).update(
      { id: In(expired.map((booking) => booking.id)) },
      { status: BookingStatus.CANCELLED },
    );
    slot.bookedCount = Math.max(0, slot.bookedCount - expired.length);
  }

  private async cancelLockedBooking(manager: EntityManager, booking: Booking): Promise<Booking> {
    const slotRepo = manager.getRepository(ProviderSlot);
    const slot = await slotRepo.findOne({ where: { id: booking.slotId }, lock: { mode: 'pessimistic_write' } });
    if (slot) {
      slot.bookedCount = Math.max(0, slot.bookedCount - 1);
      slot.version += 1;
      await slotRepo.save(slot);
    }
    booking.status = BookingStatus.CANCELLED;
    return manager.getRepository(Booking).save(booking);
  }
}
