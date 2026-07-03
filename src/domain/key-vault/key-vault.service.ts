import {
  Injectable,
  computed,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';

import { buildTimeKeyForProvider } from '../../config/build-env-config';
import type { ProviderId } from '../../config/provider-registry';

/**
 * API keys resolve from build-time `NG_APP_*` env vars. Optional in-memory
 * overrides (Settings paste) last for the current page load only — never
 * sessionStorage or localStorage.
 */
@Injectable({ providedIn: 'root' })
export class KeyVaultService {
  private readonly inMemory = signal<Partial<Record<ProviderId, string>>>({});

  private readonly _current: WritableSignal<ProviderId | null> =
    signal<ProviderId | null>(null);

  readonly currentProvider: Signal<ProviderId | null> = this._current.asReadonly();
  readonly hasKey = computed(() =>
    (['gemini', 'groq'] as ProviderId[]).some(
      (p) => this.getKeyForProvider(p) !== null,
    ),
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
    this.inMemory.update((prev) => ({ ...prev, [provider]: key }));
    this._current.set(provider);
  }

  saveKeyForProvider(provider: ProviderId, key: string): void {
    this.setKey(provider, key);
  }

  clearKey(provider: ProviderId): void {
    this.inMemory.update((prev) => {
      const next = { ...prev };
      delete next[provider];
      return next;
    });
    if (this._current() === provider) {
      const fallback = (['gemini', 'groq'] as ProviderId[]).find((p) =>
        this.readRaw(p),
      );
      this._current.set(fallback ?? null);
    }
  }

  clearKeyForProvider(provider: ProviderId): void {
    this.clearKey(provider);
  }

  clearAll(providers: readonly ProviderId[]): void {
    providers.forEach((p) => this.clearKey(p));
  }

  private readRaw(provider: ProviderId): string | null {
    const override = this.inMemory()[provider]?.trim();
    if (override) return override;
    return buildTimeKeyForProvider(provider) ?? null;
  }
}
