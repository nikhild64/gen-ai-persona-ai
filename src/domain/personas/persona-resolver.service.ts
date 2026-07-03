import { Injectable, inject } from '@angular/core';

import type { PersonaId } from '../types/persona';
import { PERSONA_REGISTRY, type PersonaRegistryEntry } from '../../personas/persona.registry';
import type { StorageKey } from '../../config/storage-keys';
import { CHAT_STORAGE_KEYS } from '../../config/storage-keys';
import type {
  ChatPersonaRef,
  CustomPersonaId,
} from '../types/custom-persona';
import { CustomPersonaStore } from '../custom-persona/custom-persona.store';
import { CUSTOM_PERSONA_THREADS_KEY } from '../custom-persona/custom-persona-thread.service';

export type PersonaStorageTarget =
  | { kind: 'builtin'; key: StorageKey }
  | { kind: 'custom-bucket'; bucketKey: typeof CUSTOM_PERSONA_THREADS_KEY; id: CustomPersonaId };

@Injectable({ providedIn: 'root' })
export class PersonaResolverService {
  private readonly customStore = inject(CustomPersonaStore);

  resolve(ref: ChatPersonaRef): PersonaRegistryEntry | null {
    if (ref.kind === 'builtin') {
      return PERSONA_REGISTRY[ref.id];
    }
    const record = this.customStore.get(ref.id);
    if (!record) return null;
    return this.customStore.toRegistryEntry(record);
  }

  storageTargetFor(ref: ChatPersonaRef): PersonaStorageTarget | null {
    if (ref.kind === 'builtin') {
      return { kind: 'builtin', key: CHAT_STORAGE_KEYS[ref.id] };
    }
    if (!this.customStore.get(ref.id)) return null;
    return {
      kind: 'custom-bucket',
      bucketKey: CUSTOM_PERSONA_THREADS_KEY,
      id: ref.id,
    };
  }

  displayName(ref: ChatPersonaRef): string {
    const entry = this.resolve(ref);
    if (!entry) return 'Advisor';
    return entry.fullDisplayName;
  }

  shortName(ref: ChatPersonaRef): string {
    const entry = this.resolve(ref);
    if (!entry) return 'Advisor';
    const parts = entry.fullDisplayName.trim().split(/\s+/);
    return parts[parts.length - 1] ?? entry.fullDisplayName;
  }

  builtinId(ref: ChatPersonaRef): PersonaId | null {
    return ref.kind === 'builtin' ? ref.id : null;
  }
}
