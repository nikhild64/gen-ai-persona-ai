import {
  Injectable,
  inject,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';

import type { PersonaId } from '../types/persona';
import type { ProviderId } from '../../config/provider-registry';
import { PROVIDER_DEFAULT_ROUTING } from '../../config/provider-registry';
import { localStoreGet, localStoreSet } from './browser-local-storage';
import { KeyVaultService } from './key-vault.service';

const STORAGE_KEY = 'persona-routing:v1';

/**
 * User-configurable persona → provider mapping. Persisted to localStorage
 * (same lifecycle as saved API keys).
 *
 * When only one provider key is saved, every persona is routed to that
 * provider automatically so a single Gemini or Groq key powers the whole app.
 */
@Injectable({ providedIn: 'root' })
export class PersonaRoutingService {
  private readonly keyVault = inject(KeyVaultService);

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

  /** Resolved provider for outbound calls (honours single-key fallback). */
  getProviderFor(persona: PersonaId): ProviderId {
    const configured = this._routing()[persona];
    const sole = this.soleAvailableProviderInternal();
    if (sole) return sole;
    return configured;
  }

  /** Provider for a custom persona record (stored providerId + sole-key fallback). */
  getProviderForCustom(storedProvider: ProviderId): ProviderId {
    const sole = this.soleAvailableProviderInternal();
    if (sole) return sole;
    return storedProvider;
  }

  hasKeyForProvider(providerId: ProviderId): boolean {
    return this.keyVault.getKeyForProvider(providerId) !== null;
  }

  /** True when the effective provider for this persona has a saved key. */
  hasKeyForPersona(persona: PersonaId): boolean {
    return this.keyVault.getKeyForProvider(this.getProviderFor(persona)) !== null;
  }

  /** True when at least one provider key exists in the vault. */
  hasAnyProviderKey(): boolean {
    return (
      this.keyVault.getKeyForProvider('gemini') !== null ||
      this.keyVault.getKeyForProvider('groq') !== null
    );
  }

  setProviderFor(persona: PersonaId, provider: ProviderId): void {
    this._routing.update((current) => ({ ...current, [persona]: provider }));
    this.persist();
  }

  reset(): void {
    this._routing.set({ ...PROVIDER_DEFAULT_ROUTING });
    this.persist();
  }

  soleAvailableProvider(): ProviderId | null {
    return this.soleAvailableProviderInternal();
  }

  private soleAvailableProviderInternal(): ProviderId | null {
    const hasGemini = this.keyVault.getKeyForProvider('gemini') !== null;
    const hasGroq = this.keyVault.getKeyForProvider('groq') !== null;
    if (hasGemini && !hasGroq) return 'gemini';
    if (hasGroq && !hasGemini) return 'groq';
    return null;
  }

  private persist(): void {
    try {
      localStoreSet(STORAGE_KEY, JSON.stringify(this._routing()));
    } catch {
      /* ignore */
    }
  }
}
