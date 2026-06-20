import type { StorageProvider } from './types';
import { LocalStorageProvider } from './local';
import { R2StorageProvider } from './r2';

function createProvider(): StorageProvider {
  const setting = process.env.STORAGE_PROVIDER?.toLowerCase().trim();

  if (setting === 'r2') {
    console.log('[storage] Provider: R2');
    return new R2StorageProvider();
  }

  if (setting && setting !== 'local') {
    console.warn(`[storage] Unknown STORAGE_PROVIDER "${setting}" — falling back to local filesystem`);
  } else if (!setting) {
    console.log('[storage] Provider: local filesystem (set STORAGE_PROVIDER=r2 to use Cloudflare R2)');
  } else {
    console.log('[storage] Provider: local filesystem');
  }

  return new LocalStorageProvider();
}

export const storage: StorageProvider = createProvider();
export type { StorageProvider } from './types';
