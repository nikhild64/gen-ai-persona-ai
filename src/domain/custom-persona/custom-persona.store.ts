import { Injectable, computed, signal } from '@angular/core';

import type { StorageKey } from '../../config/storage-keys';
import { DEFAULT_MODERATION_TEMPLATES } from '../../config/default-moderation-templates';
import { localStoreGet, localStoreSet } from '../key-vault/browser-local-storage';
import type {
  CustomPersonaId,
  CustomPersonaRecord,
} from '../types/custom-persona';
import { isCustomPersonaId } from '../types/custom-persona';
import type {
  PersonaRegistryEntry,
  PromptComposition,
} from '../../personas/persona.registry';

export const CUSTOM_PERSONAS_STORAGE_KEY = 'custom-personas:v1' as const;

@Injectable({ providedIn: 'root' })
export class CustomPersonaStore {
  private readonly _personas = signal<readonly CustomPersonaRecord[]>([]);

  readonly personas = this._personas.asReadonly();
  readonly count = computed(() => this._personas().length);

  constructor() {
    this.loadFromStorage();
  }

  list(): readonly CustomPersonaRecord[] {
    return this._personas();
  }

  get(id: CustomPersonaId): CustomPersonaRecord | undefined {
    return this._personas().find((p) => p.id === id);
  }

  save(record: CustomPersonaRecord): void {
    this._personas.update((current) => {
      const without = current.filter((p) => p.id !== record.id);
      return [...without, record];
    });
    this.persist();
  }

  delete(id: CustomPersonaId): void {
    this._personas.update((current) => current.filter((p) => p.id !== id));
    this.persist();
  }

  toRegistryEntry(record: CustomPersonaRecord): PersonaRegistryEntry {
    const prompt: PromptComposition = {
      ...DEFAULT_MODERATION_TEMPLATES,
      identityBlock: record.prompt.identityBlock,
      voiceRules: record.prompt.voiceRules,
      refusalRules: record.prompt.refusalRules,
      fewShots: record.prompt.fewShots,
      driftRefresh: record.prompt.driftRefresh,
      selfVerificationChecklist: record.prompt.selfVerificationChecklist,
      selfIdentificationResponse: DEFAULT_MODERATION_TEMPLATES.selfIdentificationResponse,
    };
    return {
      prompt,
      greeting: record.greeting,
      inputPlaceholder: record.inputPlaceholder,
      starterQuestions: record.starterQuestions,
      providerId: record.providerId,
      fullDisplayName: record.fullDisplayName,
      tagline: record.tagline,
      era: record.era,
      disclaimerTier: record.disclaimerTier,
      voiceReminder: record.prompt.voiceReminder,
    };
  }

  private loadFromStorage(): void {
    const raw = localStoreGet(CUSTOM_PERSONAS_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const valid = parsed.filter(isValidRecord);
      this._personas.set(valid);
    } catch {
      /* corrupt storage */
    }
  }

  private persist(): void {
    localStoreSet(
      CUSTOM_PERSONAS_STORAGE_KEY,
      JSON.stringify(this._personas()),
    );
  }
}

function isValidRecord(value: unknown): value is CustomPersonaRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<CustomPersonaRecord>;
  return (
    typeof r.id === 'string' &&
    isCustomPersonaId(r.id) &&
    typeof r.fullDisplayName === 'string' &&
    typeof r.greeting === 'string' &&
    r.prompt !== undefined &&
    typeof r.prompt === 'object'
  );
}
