import {
  Injectable,
  computed,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';

import type { ProviderId } from '../../config/provider-registry';

/**
 * AD-11 — sessionStorage-only key vault. Keys clear on tab close and never
 * touch IndexedDB, logs, or analytics event payloads (redaction registry in
 * `LoggerService` + `VercelAnalyticsAdapter` scrubs any stringified copy
 * before it leaves the browser).
 *
 * `currentProvider` reactive signal drives the key-status badge (E6-S3).
 */
@Injectable({ providedIn: 'root' })
export class KeyVaultService {
  private readonly _current: WritableSignal<ProviderId | null> =
    signal<ProviderId | null>(null);

  readonly currentProvider: Signal<ProviderId | null> = this._current.asReadonly();
  readonly hasKey = computed(() => this._current() !== null);

  constructor() {
    // Prime the signal on construction — sessionStorage may already carry a
    // key from a prior page load in this tab.
    for (const p of ['gemini', 'groq'] as ProviderId[]) {
      if (this.readRaw(p)) {
        this._current.set(p);
        break;
      }
    }
  }

  getKeyForProvider(provider: ProviderId): string | null {
    return this.readRaw(provider);
  }

  setKey(provider: ProviderId, key: string): void {
    try {
      sessionStorage.setItem(KeyVaultService.storageKey(provider), key);
      this._current.set(provider);
    } catch {
      /* sessionStorage unavailable (private mode) — silently drop. */
    }
  }

  saveKeyForProvider(provider: ProviderId, key: string): void {
    this.setKey(provider, key);
  }

  clearKey(provider: ProviderId): void {
    try {
      sessionStorage.removeItem(KeyVaultService.storageKey(provider));
      if (this._current() === provider) this._current.set(null);
    } catch {
      /* ignore */
    }
  }

  clearKeyForProvider(provider: ProviderId): void {
    this.clearKey(provider);
  }

  clearAll(providers: readonly ProviderId[]): void {
    providers.forEach((p) => this.clearKey(p));
  }

  private readRaw(provider: ProviderId): string | null {
    try {
      return sessionStorage.getItem(KeyVaultService.storageKey(provider));
    } catch {
      return null;
    }
  }

  private static storageKey(provider: ProviderId): string {
    return `byo-key:${provider}:v1`;
  }
}
