import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

@Injectable()
export class FieldCryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const configured = config.get<string>('FIELD_ENCRYPTION_KEY');
    if (configured) {
      const decoded = Buffer.from(configured, 'base64');
      if (decoded.length !== 32) throw new Error('FIELD_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
      this.key = decoded;
      return;
    }

    const environment = config.get<string>('NODE_ENV') ?? 'development';
    if (environment === 'production' || environment === 'staging') {
      throw new Error('FIELD_ENCRYPTION_KEY is required in staging and production');
    }
    this.key = createHash('sha256').update('nearfind-local-development-field-key').digest();
  }

  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  decrypt(value: string): string {
    const [version, ivPart, tagPart, dataPart] = value.split('.');
    if (version !== 'v1' || !ivPart || !tagPart || !dataPart) throw new Error('Encrypted field has an invalid format');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivPart, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64url')), decipher.final()]).toString('utf8');
  }
}
