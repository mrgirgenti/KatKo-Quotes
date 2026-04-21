import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

export function ensureOrgDir(orgId: string): string {
  const dir = path.join(UPLOADS_DIR, orgId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeUpload(orgId: string, originalName: string, buffer: Buffer): string {
  ensureOrgDir(orgId);
  const uuid = randomUUID();
  const safeName = originalName.replace(/[^a-zA-Z0-9._\-]/g, '_');
  const filename = `${uuid}-${safeName}`;
  const filepath = path.join(UPLOADS_DIR, orgId, filename);
  fs.writeFileSync(filepath, buffer);
  return `${orgId}/${filename}`;
}

export function readUpload(storageKey: string): Buffer | null {
  try {
    const filepath = path.join(UPLOADS_DIR, storageKey);
    return fs.readFileSync(filepath);
  } catch {
    return null;
  }
}

export function deleteUpload(storageKey: string): void {
  try {
    const filepath = path.join(UPLOADS_DIR, storageKey);
    fs.unlinkSync(filepath);
  } catch {
  }
}

export const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/png':                  'png',
  'image/jpeg':                 'jpg',
  'image/svg+xml':              'svg',
  'application/pdf':            'pdf',
  'application/postscript':     'ai',
  'application/illustrator':    'ai',
  'image/vnd.adobe.photoshop':  'psd',
};

export function getMimeLabel(mimeType: string | null): string {
  if (!mimeType) return 'FILE';
  const ext = ALLOWED_MIME_TYPES[mimeType];
  return ext ? ext.toUpperCase() : 'FILE';
}

export function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
