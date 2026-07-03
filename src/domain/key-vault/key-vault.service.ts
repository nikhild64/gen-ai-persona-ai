import {
  Injectable,
  computed,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';

import type { ProviderId } from '../../config/provider-registry';
import {
  localStoreGet,
  localStoreRemove,
  localStoreSet,
} from './browser-local-storage';

/**
 * AD-11 — localStorage key vault. Keys stay in the browser only and never
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
  readonly hasKey = computed(
    () =>
      this.getKeyForProvider('gemini') !== null ||
      this.getKeyForProvider('groq') !== null,
  );

  constructor() {
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
    localStoreSet(KeyVaultService.storageKey(provider), key);
    this._current.set(provider);
  }

  saveKeyForProvider(provider: ProviderId, key: string): void {
    this.setKey(provider, key);
  }

  clearKey(provider: ProviderId): void {
    localStoreRemove(KeyVaultService.storageKey(provider));
    if (this._current() === provider) {
      const fallback =
        (['gemini', 'groq'] as ProviderId[]).find(
          (p) => p !== provider && this.readRaw(p),
        ) ?? null;
      this._current.set(fallback);
    }
  }

  clearKeyForProvider(provider: ProviderId): void {
    this.clearKey(provider);
  }

  clearAll(providers: readonly ProviderId[]): void {
    providers.forEach((p) => this.clearKey(p));
  }

  private readRaw(provider: ProviderId): string | null {
    return localStoreGet(KeyVaultService.storageKey(provider));
  }

  private static storageKey(provider: ProviderId): string {
    return `byo-key:${provider}:v1`;
  }
}
