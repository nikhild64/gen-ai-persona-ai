import {
  Injectable,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';

import type { ProviderId } from '../../config/provider-registry';
import { PROVIDER_DEFAULT_MODELS } from '../../config/provider-registry';

const STORAGE_KEY = 'model-selection:v1';

/**
 * User-configurable model per provider. Falls back to
 * `PROVIDER_DEFAULT_MODELS` if the user hasn't chosen one.
 *
 * We deliberately do NOT validate the model id against `AVAILABLE_MODELS`
 * (the static bundled list) — the settings dropdown is fed from the live
 * discovery service which may surface many model coordinates the static
 * list doesn't know about. A stricter validation here rejected those live
 * picks silently, so the UI showed the "saved" toast but the storage
 * write was skipped. If the coordinate ends up being invalid at request
 * time, the provider will return a clear error we already surface.
 *
 * Persisted in sessionStorage (same lifecycle as API keys + persona
 * routing).
 */
@Injectable({ providedIn: 'root' })
export class ModelSelectionService {
  private readonly _selection: WritableSignal<Record<ProviderId, string>> =
    signal<Record<ProviderId, string>>({ ...PROVIDER_DEFAULT_MODELS });

  readonly selection: Signal<Record<ProviderId, string>> =
    this._selection.asReadonly();

  constructor() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Record<ProviderId, string>>;
      const restored: Record<ProviderId, string> = {
        ...PROVIDER_DEFAULT_MODELS,
      };
      (Object.keys(PROVIDER_DEFAULT_MODELS) as ProviderId[]).forEach((p) => {
        const stored = parsed[p];
        if (typeof stored === 'string' && stored.length > 0) {
          restored[p] = stored;
        }
      });
      this._selection.set(restored);
    } catch {
      /* sessionStorage unavailable or bad JSON — fall back to defaults. */
    }
  }

  getModelFor(provider: ProviderId): string {
    return this._selection()[provider] ?? PROVIDER_DEFAULT_MODELS[provider];
  }

  setModelFor(provider: ProviderId, modelId: string): void {
    if (typeof modelId !== 'string' || modelId.length === 0) return;
    this._selection.update((current) => ({ ...current, [provider]: modelId }));
    this.persist();
  }

  reset(): void {
    this._selection.set({ ...PROVIDER_DEFAULT_MODELS });
    this.persist();
  }

  private persist(): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this._selection()));
    } catch {
      /* ignore */
    }
  }
}
