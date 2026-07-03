import {
  Injectable,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';

import type { PersonaId } from '../types/persona';
import type { ProviderId } from '../../config/provider-registry';
import { PROVIDER_DEFAULT_ROUTING } from '../../config/provider-registry';
import type { StorageKey } from '../../config/storage-keys';

const STORAGE_KEY: StorageKey = 'settings:persona-routing:v1';

const VALID_PROVIDERS = new Set<ProviderId>(['gemini', 'groq']);

/**
 * User-configurable persona → provider mapping. Persisted to sessionStorage
 * (same lifecycle as saved API keys — clears on tab close).
 *
 * The `PROVIDER_DEFAULT_ROUTING` values from `provider-registry.ts` remain
 * the source-of-truth defaults; this service just lets the user override
 * per-persona at runtime via the settings modal. `ChatOrchestrator` and
 * `AskBothSequencerService` read `getProviderFor(persona)` instead of the
 * hard-coded default so the mapping is honoured for every outbound call.
 */
@Injectable({ providedIn: 'root' })
export class PersonaRoutingService {
  private readonly _routing: WritableSignal<Record<PersonaId, ProviderId>> =
    signal<Record<PersonaId, ProviderId>>({ ...PROVIDER_DEFAULT_ROUTING });

  readonly routing: Signal<Record<PersonaId, ProviderId>> =
    this._routing.asReadonly();

  constructor() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<
        Record<PersonaId, ProviderId>
      >;
      const sanitized: Partial<Record<PersonaId, ProviderId>> = {};
      for (const [persona, provider] of Object.entries(parsed) as Array<
        [PersonaId, ProviderId]
      >) {
        if (VALID_PROVIDERS.has(provider)) {
          sanitized[persona] = provider;
        }
      }
      this._routing.set({
        ...PROVIDER_DEFAULT_ROUTING,
        ...sanitized,
      });
    } catch {
      /* sessionStorage unavailable or bad JSON — fall back to defaults. */
    }
  }

  getProviderFor(persona: PersonaId): ProviderId {
    return this._routing()[persona];
  }

  setProviderFor(persona: PersonaId, provider: ProviderId): void {
    this._routing.update((current) => ({ ...current, [persona]: provider }));
    this.persist();
  }

  reset(): void {
    this._routing.set({ ...PROVIDER_DEFAULT_ROUTING });
    this.persist();
  }

  private persist(): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this._routing()));
    } catch {
      /* ignore */
    }
  }
}
