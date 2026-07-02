import { Injectable, signal } from '@angular/core';

import type { PersonaId } from '../../domain/types/persona';
import { isPersonaId } from '../../domain/types/persona';
import type { StorageKey } from '../../config/storage-keys';

const STORAGE_KEY: StorageKey = 'settings:blended-pair:v1';

const DEFAULT_PAIR: { a: PersonaId; b: PersonaId } = {
  a: 'hitesh',
  b: 'piyush',
};

/**
 * V2 — persists the active Blended pair (Persona A / Persona B) in
 * sessionStorage. Persona A carries the provider slot for blended dispatch.
 */
@Injectable({ providedIn: 'root' })
export class BlendedPairService {
  readonly personaA = signal<PersonaId>(DEFAULT_PAIR.a);
  readonly personaB = signal<PersonaId>(DEFAULT_PAIR.b);

  constructor() {
    this.loadFromSession();
  }

  getPair(): { a: PersonaId; b: PersonaId } {
    return { a: this.personaA(), b: this.personaB() };
  }

  setPersonaA(id: PersonaId): void {
    if (id === this.personaB()) {
      this.personaB.set(this.pickAlternate(id));
    }
    this.personaA.set(id);
    this.persist();
  }

  setPersonaB(id: PersonaId): void {
    if (id === this.personaA()) {
      this.personaA.set(this.pickAlternate(id));
    }
    this.personaB.set(id);
    this.persist();
  }

  private pickAlternate(exclude: PersonaId): PersonaId {
    const order: PersonaId[] = [
      'hitesh',
      'piyush',
      'musk',
      'jobs',
      'gandhi',
      'einstein',
      'newton',
    ];
    return order.find((p) => p !== exclude) ?? 'hitesh';
  }

  private loadFromSession(): void {
    if (typeof sessionStorage === 'undefined') return;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { a?: string; b?: string };
      if (
        parsed.a &&
        parsed.b &&
        isPersonaId(parsed.a) &&
        isPersonaId(parsed.b) &&
        parsed.a !== parsed.b
      ) {
        this.personaA.set(parsed.a);
        this.personaB.set(parsed.b);
      }
    } catch {
      /* ignore corrupt session value */
    }
  }

  private persist(): void {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ a: this.personaA(), b: this.personaB() }),
    );
  }
}
