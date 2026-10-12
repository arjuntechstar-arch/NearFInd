import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { ServiceLocation } from '../../discovery/entities/service-location.entity.js';
import type { User } from './user.entity.js';

@Entity({ name: 'favorites' })
export class Favorite {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @PrimaryColumn({ name: 'service_location_id', type: 'uuid' })
  serviceLocationId!: string;

  @ManyToOne('User', 'favorites', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne('ServiceLocation', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_location_id' })
  serviceLocation!: ServiceLocation;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
