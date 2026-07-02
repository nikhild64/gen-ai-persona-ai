import { Injectable } from '@angular/core';

import type { ProviderId } from '../../config/provider-registry';

/**
 * AD-11 — BYO-Key vault. sessionStorage isolation is intentional: keys clear
 * when the tab closes, never touch IndexedDB, never appear in analytics or
 * logs (redaction wiring lives in `LoggerService` + `VercelAnalyticsAdapter`
 * once E6-S1 lands).
 *
 * This is a minimal stub. E6-S1 replaces with the full KeyVaultService that
 * also emits `byo_key_saved` analytics + reads through the redaction
 * registry.
 */
@Injectable({ providedIn: 'root' })
export class KeyVaultService {
  private static storageKey(provider: ProviderId): string {
    return `byo-key:${provider}:v1`;
  }

  getKeyForProvider(provider: ProviderId): string | null {
    try {
      return sessionStorage.getItem(KeyVaultService.storageKey(provider));
    } catch {
      return null;
    }
  }

  saveKeyForProvider(provider: ProviderId, key: string): void {
    try {
      sessionStorage.setItem(KeyVaultService.storageKey(provider), key);
    } catch {
      /* sessionStorage unavailable (e.g. private mode) — swallow. */
    }
  }

  clearKeyForProvider(provider: ProviderId): void {
    try {
      sessionStorage.removeItem(KeyVaultService.storageKey(provider));
    } catch {
      /* ignore */
    }
  }

  clearAll(providers: readonly ProviderId[]): void {
    providers.forEach((p) => this.clearKeyForProvider(p));
  }
}
