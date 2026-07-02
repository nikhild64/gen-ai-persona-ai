import {
  Injectable,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';

import type { PersonaId } from '../types/persona';
import type { ProviderId } from '../../config/provider-registry';
import { PROVIDER_DEFAULT_ROUTING } from '../../config/provider-registry';
import { localStoreGet, localStoreSet } from './browser-local-storage';

const STORAGE_KEY = 'persona-routing:v1';

/**
 * User-configurable persona → provider mapping. Persisted to localStorage
 * (same lifecycle as saved API keys).
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
      const raw = localStoreGet(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<
        Record<PersonaId, ProviderId>
      >;
      this._routing.set({
        ...PROVIDER_DEFAULT_ROUTING,
        ...parsed,
      });
    } catch {
      /* localStorage unavailable or bad JSON — fall back to defaults. */
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
      localStoreSet(STORAGE_KEY, JSON.stringify(this._routing()));
    } catch {
      /* ignore */
    }
  }
}
