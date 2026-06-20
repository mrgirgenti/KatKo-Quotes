import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import type { StorageProvider } from './types';

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`[R2] Missing required environment variable: ${key}`);
  return v;
}

interface ParsedKey {
  bucket: string;
  objectKey: string;
}

function parseStorageKey(storageKey: string): ParsedKey | null {
  if (storageKey.startsWith('pub/')) {
    return { bucket: requireEnv('R2_PUBLIC_BUCKET'), objectKey: storageKey.slice(4) };
  }
  if (storageKey.startsWith('prv/')) {
    return { bucket: requireEnv('R2_PRIVATE_BUCKET'), objectKey: storageKey.slice(4) };
  }
  console.error('[R2] Unrecognized storageKey format — expected pub/ or prv/ prefix:', storageKey);
  return null;
}

export class R2StorageProvider implements StorageProvider {
  private readonly client: S3Client;

  constructor() {
    this.client = new S3Client({
      region: 'auto',
      endpoint: requireEnv('R2_ENDPOINT'),
      credentials: {
        accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
      },
      forcePathStyle: false,
    });
  }

  async write(orgId: string, originalName: string, buffer: Buffer, isPublic = false): Promise<string> {
    const uuid = randomUUID();
    const safeName = originalName.replace(/[^a-zA-Z0-9._\-]/g, '_');
    const filename = `${uuid}-${safeName}`;
    const objectKey = `orgs/${orgId}/${filename}`;
    const bucket = isPublic ? requireEnv('R2_PUBLIC_BUCKET') : requireEnv('R2_PRIVATE_BUCKET');
    const prefix = isPublic ? 'pub' : 'prv';

    await this.client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: 'application/octet-stream',
    }));

    return `${prefix}/${objectKey}`;
  }

  async read(storageKey: string): Promise<Buffer | null> {
    const parsed = parseStorageKey(storageKey);
    if (!parsed) return null;

    try {
      const result = await this.client.send(new GetObjectCommand({
        Bucket: parsed.bucket,
        Key: parsed.objectKey,
      }));
      const bytes = await result.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch (e: any) {
      if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) return null;
      throw e;
    }
  }

  async delete(storageKey: string): Promise<void> {
    const parsed = parseStorageKey(storageKey);
    if (!parsed) return;

    try {
      await this.client.send(new DeleteObjectCommand({
        Bucket: parsed.bucket,
        Key: parsed.objectKey,
      }));
    } catch (e: any) {
      if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) return;
      throw e;
    }
  }
}
