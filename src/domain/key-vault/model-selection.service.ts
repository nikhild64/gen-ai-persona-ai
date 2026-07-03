import {
  Injectable,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';

import { buildTimeModelForProvider } from '../../config/build-env-config';
import type { ProviderId } from '../../config/provider-registry';
import { PROVIDER_DEFAULT_MODELS } from '../../config/provider-registry';

function initialSelection(): Record<ProviderId, string> {
  return {
    gemini: buildTimeModelForProvider('gemini'),
    groq: buildTimeModelForProvider('groq'),
  };
}

/**
 * Model per provider. Defaults from `NG_APP_GEMINI_MODEL` /
 * `NG_APP_GROQ_MODEL` at build time, then `PROVIDER_DEFAULT_MODELS`.
 * Runtime changes stay in memory for the current page load only.
 */
@Injectable({ providedIn: 'root' })
export class ModelSelectionService {
  private readonly _selection: WritableSignal<Record<ProviderId, string>> =
    signal<Record<ProviderId, string>>(initialSelection());

  readonly selection: Signal<Record<ProviderId, string>> =
    this._selection.asReadonly();

  getModelFor(provider: ProviderId): string {
    return this._selection()[provider] ?? PROVIDER_DEFAULT_MODELS[provider];
  }

  setModelFor(provider: ProviderId, modelId: string): void {
    if (typeof modelId !== 'string' || modelId.length === 0) return;
    this._selection.update((current) => ({ ...current, [provider]: modelId }));
  }

  reset(): void {
    this._selection.set(initialSelection());
  }
}
