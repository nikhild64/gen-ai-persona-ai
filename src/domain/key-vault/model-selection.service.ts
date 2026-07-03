import {
  Injectable,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';

import { buildTimeModelForProvider } from '../../config/build-env-config';
import type { ProviderId } from '../../config/provider-registry';
import { PROVIDER_DEFAULT_MODELS } from '../../config/provider-registry';
import type { StorageKey } from '../../config/storage-keys';

const STORAGE_KEY: StorageKey = 'settings:model-selection:v1';

const PROVIDERS: ProviderId[] = ['gemini', 'groq'];

function initialSelection(): Record<ProviderId, string> {
  return {
    gemini: buildTimeModelForProvider('gemini'),
    groq: buildTimeModelForProvider('groq'),
  };
}

/**
 * Model per provider. Defaults from `NG_APP_GEMINI_MODEL` /
 * `NG_APP_GROQ_MODEL` at build time, then `PROVIDER_DEFAULT_MODELS`.
 * User overrides persist in sessionStorage (same tab lifetime as persona
 * routing) — API keys intentionally stay in-memory only.
 */
@Injectable({ providedIn: 'root' })
export class ModelSelectionService {
  private readonly _selection: WritableSignal<Record<ProviderId, string>> =
    signal<Record<ProviderId, string>>(this.loadPersisted());

  readonly selection: Signal<Record<ProviderId, string>> =
    this._selection.asReadonly();

  getModelFor(provider: ProviderId): string {
    return this._selection()[provider] ?? PROVIDER_DEFAULT_MODELS[provider];
  }

  setModelFor(provider: ProviderId, modelId: string): void {
    if (typeof modelId !== 'string' || modelId.length === 0) return;
    this._selection.update((current) => ({ ...current, [provider]: modelId }));
    this.persist();
  }

  reset(): void {
    this._selection.set(initialSelection());
    this.persist();
  }

  private loadPersisted(): Record<ProviderId, string> {
    const base = initialSelection();
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return base;
      const parsed = JSON.parse(raw) as Partial<Record<ProviderId, string>>;
      const sanitized: Partial<Record<ProviderId, string>> = {};
      for (const provider of PROVIDERS) {
        const modelId = parsed[provider];
        if (typeof modelId === 'string' && modelId.length > 0) {
          sanitized[provider] = modelId;
        }
      }
      return { ...base, ...sanitized };
    } catch {
      return base;
    }
  }

  private persist(): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this._selection()));
    } catch {
      /* sessionStorage unavailable */
    }
  }
}
