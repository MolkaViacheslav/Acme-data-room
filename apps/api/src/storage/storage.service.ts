import { Inject, Injectable, Logger } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

import type { AppEnv } from '../config/env';
import { APP_ENV } from '../config/env.module';

/**
 * Short on purpose. A leaked URL stops working quickly, and the client
 * re-requests one when it expires rather than holding a long-lived link.
 */
export const DOWNLOAD_URL_TTL_SECONDS = 60;

/**
 * Everything this app does with Supabase Storage.
 *
 * The bucket is private: objects are only ever reachable through a signed URL
 * minted here, after `AccessService` has approved the caller. The service-role
 * key never leaves the server.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  // Taken from the factory rather than annotated: `SupabaseClient`'s default
  // generics do not match what `createClient` actually returns.
  private readonly client: ReturnType<typeof createClient>;
  private readonly bucket: string;

  constructor(@Inject(APP_ENV) env: AppEnv) {
    this.bucket = env.supabaseStorageBucket;
    this.client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /** A time-limited URL for reading one object. */
  async createSignedDownloadUrl(
    storageKey: string,
    expiresInSeconds: number = DOWNLOAD_URL_TTL_SECONDS,
  ): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(storageKey, expiresInSeconds);

    if (error !== null) {
      throw new Error(`Could not sign a download URL for ${storageKey}: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Best-effort cleanup after the database rows are already gone.
   *
   * Deliberately does not throw. The database is the source of truth: once a
   * file row is deleted the object is unreachable regardless, and failing here
   * would either roll back a correct deletion or surface an error the user can
   * do nothing about. An orphaned object is a cost problem, not a correctness
   * one, so it is logged for later reconciliation.
   */
  async removeObjects(storageKeys: readonly string[]): Promise<void> {
    if (storageKeys.length === 0) return;

    try {
      const { error } = await this.client.storage.from(this.bucket).remove([...storageKeys]);

      if (error !== null) {
        this.logger.error(
          `Orphaned ${storageKeys.length} storage object(s) after delete: ${error.message}`,
        );
      }
    } catch (cause) {
      this.logger.error(
        `Orphaned ${storageKeys.length} storage object(s) after delete`,
        cause instanceof Error ? cause.stack : String(cause),
      );
    }
  }
}
