import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env';
import { notFound } from '../utils/errors';

export interface StorageAdapter {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

const SAFE_KEY = /^[A-Za-z0-9/_.-]+$/;

function assertSafeKey(key: string): void {
  if (!SAFE_KEY.test(key) || key.includes('..') || key.startsWith('/')) {
    throw new Error('Invalid storage key.');
  }
}

/**
 * Development/default adapter: files live in a private directory outside any web
 * root and are only readable through authorised API endpoints. Production must
 * mount a persistent private volume or provide an S3-compatible adapter.
 */
class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly baseDir: string) {}

  private resolve(key: string): string {
    assertSafeKey(key);
    return path.join(this.baseDir, key);
  }

  async put(key: string, data: Buffer): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data, { mode: 0o600 });
  }

  async get(key: string): Promise<Buffer> {
    try {
      return await readFile(this.resolve(key));
    } catch {
      throw notFound('The requested file is not available.');
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch {
      // Deleting an absent private file is not an error for callers.
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await readFile(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}

export const storage: StorageAdapter = new LocalStorageAdapter(env.storageDir);
