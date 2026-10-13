import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomUUID } from 'node:crypto';

const ALLOWED_MIME_TYPES = new Map([
  ['image/jpeg', { extension: 'jpg', maxBytes: 10_000_000 }],
  ['image/png', { extension: 'png', maxBytes: 10_000_000 }],
  ['image/webp', { extension: 'webp', maxBytes: 10_000_000 }],
  ['audio/mpeg', { extension: 'mp3', maxBytes: 20_000_000 }],
  ['audio/mp4', { extension: 'm4a', maxBytes: 20_000_000 }],
]);

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}

function encodePath(value: string): string {
  return value.split('/').map((part) => encodeURIComponent(part)).join('/');
}

@Injectable()
export class StorageService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  createUploadIntent(userId: string, purpose: string, mimeType: string, sizeBytes: number) {
    const rule = ALLOWED_MIME_TYPES.get(mimeType);
    if (!rule || !Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > rule.maxBytes) {
      throw new BadRequestException('Unsupported upload type or size');
    }
    if (!['contribution', 'review', 'chat', 'property'].includes(purpose)) {
      throw new BadRequestException('Unsupported upload purpose');
    }

    const endpoint = new URL(this.config.get<string>('S3_ENDPOINT') ?? 'http://localhost:9000');
    const region = this.config.get<string>('S3_REGION') ?? 'us-east-1';
    const bucket = this.config.get<string>('S3_BUCKET') ?? 'nearfind-media';
    const accessKey = this.config.get<string>('S3_ACCESS_KEY_ID') ?? 'nearfind';
    const secretKey = this.config.get<string>('S3_SECRET_ACCESS_KEY') ?? 'nearfind-local-change-me';
    const now = new Date();
    const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = iso.slice(0, 8);
    const objectKey = `users/${userId}/${purpose}/${randomUUID()}.${rule.extension}`;
    const credentialScope = `${date}/${region}/s3/aws4_request`;
    const path = `/${encodeURIComponent(bucket)}/${encodePath(objectKey)}`;
    const params = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${accessKey}/${credentialScope}`,
      'X-Amz-Date': iso,
      'X-Amz-Expires': '300',
      'X-Amz-SignedHeaders': 'host',
    });
    params.sort();
    const canonicalQuery = params.toString();
    const canonicalHeaders = `host:${endpoint.host}\n`;
    const canonicalRequest = `PUT\n${path}\n${canonicalQuery}\n${canonicalHeaders}\nhost\nUNSIGNED-PAYLOAD`;
    const stringToSign = `AWS4-HMAC-SHA256\n${iso}\n${credentialScope}\n${sha256(canonicalRequest)}`;
    const dateKey = hmac(`AWS4${secretKey}`, date);
    const regionKey = hmac(dateKey, region);
    const serviceKey = hmac(regionKey, 's3');
    const signingKey = hmac(serviceKey, 'aws4_request');
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    const uploadUrl = new URL(endpoint.toString());
    uploadUrl.pathname = path;
    uploadUrl.search = `${canonicalQuery}&X-Amz-Signature=${signature}`;

    return {
      objectKey,
      uploadUrl: uploadUrl.toString(),
      expiresAt: new Date(now.getTime() + 300_000).toISOString(),
      requiredHeaders: { 'content-type': mimeType },
    };
  }

  assertOwnedObjectKey(userId: string, purpose: string, objectKey: string): void {
    const expectedPrefix = `users/${userId}/${purpose}/`;
    if (!objectKey.startsWith(expectedPrefix) || objectKey.includes('..')) {
      throw new BadRequestException('Upload object key is outside the authenticated user scope');
    }
  }
}
