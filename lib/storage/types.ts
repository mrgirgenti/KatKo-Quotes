export interface StorageProvider {
  write(orgId: string, originalName: string, buffer: Buffer, isPublic?: boolean): Promise<string>;
  read(storageKey: string): Promise<Buffer | null>;
  delete(storageKey: string): Promise<void>;
}
