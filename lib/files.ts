import { storage } from './storage';

export async function writeUpload(orgId: string, originalName: string, buffer: Buffer, isPublic = false): Promise<string> {
  return storage.write(orgId, originalName, buffer, isPublic);
}

export async function readUpload(storageKey: string): Promise<Buffer | null> {
  return storage.read(storageKey);
}

export async function deleteUpload(storageKey: string): Promise<void> {
  return storage.delete(storageKey);
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

export function getMimeLabel(mimeType: string | null, fileName?: string): string {
  if (fileName) {
    const n = fileName.toLowerCase();
    if (n.endsWith('.ps')) return 'PS';
    if (n.endsWith('.emb')) return 'EMB';
    if (n.endsWith('.dst')) return 'DST';
    if (n.endsWith('.pes')) return 'PES';
  }
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
