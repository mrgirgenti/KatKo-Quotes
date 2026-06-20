import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { StorageProvider } from './types';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

function ensureDir(orgId: string): void {
  fs.mkdirSync(path.join(UPLOADS_DIR, orgId), { recursive: true });
}

export class LocalStorageProvider implements StorageProvider {
  async write(orgId: string, originalName: string, buffer: Buffer, _isPublic?: boolean): Promise<string> {
    ensureDir(orgId);
    const uuid = randomUUID();
    const safeName = originalName.replace(/[^a-zA-Z0-9._\-]/g, '_');
    const filename = `${uuid}-${safeName}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, orgId, filename), buffer);
    return `${orgId}/${filename}`;
  }

  async read(storageKey: string): Promise<Buffer | null> {
    try {
      const localKey = storageKey.replace(/^(pub|prv)\//, '');
      return fs.readFileSync(path.join(UPLOADS_DIR, localKey));
    } catch {
      return null;
    }
  }

  async delete(storageKey: string): Promise<void> {
    try {
      const localKey = storageKey.replace(/^(pub|prv)\//, '');
      fs.unlinkSync(path.join(UPLOADS_DIR, localKey));
    } catch {}
  }
}
