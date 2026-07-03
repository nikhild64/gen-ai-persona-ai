import { Injectable, inject } from '@angular/core';

import { ADAPTER_FACTORY } from '../chat/chat-orchestrator.service';
import { KeyVaultService } from '../key-vault/key-vault.service';
import { PersonaRoutingService } from '../key-vault/persona-routing.service';
import { ModelSelectionService } from '../key-vault/model-selection.service';
import type { ProviderId } from '../../config/provider-registry';
import type { ProviderPort } from '../ports/provider.port';
import type {
  CustomPersonaRecord,
  GeneratedCustomPersonaPayload,
} from '../types/custom-persona';
import { newCustomPersonaId } from '../types/custom-persona';
import type {
  PersonaDisclaimerTier,
  PersonaEra,
} from '../../personas/persona.registry';
import { CustomPersonaStore } from './custom-persona.store';

const MAX_FIELD_CHARS = 4096;
const VALID_ERAS: readonly PersonaEra[] = [
  'Living',
  '20th century',
  '17th century',
];
const VALID_TIERS: readonly PersonaDisclaimerTier[] = [
  'cohort',
  'contemporary',
  'deceased-recent',
  'historical',
];

const GENERATION_SYSTEM_PROMPT = `You generate AI persona definitions for Council — a multi-persona educational chat site.
Return ONLY valid JSON (no markdown fences, no commentary) matching this schema:

{
  "fullDisplayName": string,
  "tagline": string (short hook, max 120 chars),
  "era": "Living" | "20th century" | "17th century",
  "disclaimerTier": "contemporary" | "deceased-recent" | "historical" | "cohort",
  "greeting": string (in-character welcome, 1-3 sentences),
  "inputPlaceholder": string,
  "starterQuestions": string[3],
  "prompt": {
    "identityBlock": string (who they are, Council context, AI disclaimer),
    "voiceRules": string (register, length, NEVER rules),
    "refusalRules": string,
    "voiceReminder": string (one paragraph reminder),
    "fewShots": [{"user": string, "assistant": string}, ...] (2-3 examples),
    "driftRefresh": string (short voice reminder block),
    "selfVerificationChecklist": string
  }
}

Rules:
- Famous people: infer from public knowledge when only a name is given.
- Obscure people: use provided details faithfully.
- Living public figures: disclaimerTier "contemporary".
- Deceased 20th century: "deceased-recent" or "historical".
- Never claim to be the real person; always an AI simulation for education.
- No financial, medical, or political endorsement advice.
- English only for voice output.`;

export class CustomPersonaGenerationError extends Error {
  constructor(
    message: string,
    readonly code: 'no_key' | 'provider_error' | 'invalid_json' | 'validation',
  ) {
    super(message);
    this.name = 'CustomPersonaGenerationError';
  }
}

@Injectable({ providedIn: 'root' })
export class CustomPersonaGeneratorService {
  private readonly keyVault = inject(KeyVaultService);
  private readonly personaRouting = inject(PersonaRoutingService);
  private readonly modelSelection = inject(ModelSelectionService);
  private readonly adapterFactory = inject(ADAPTER_FACTORY);
  private readonly store = inject(CustomPersonaStore);

  async generate(
    name: string,
    details?: string,
  ): Promise<CustomPersonaRecord> {
    const providerId = this.resolveGenerationProvider();
    const key = this.keyVault.getKeyForProvider(providerId);
    if (!key) {
      throw new CustomPersonaGenerationError(
        'No API key configured.',
        'no_key',
      );
    }

    const userPrompt = details?.trim()
      ? `Create a persona for: ${name.trim()}\n\nAdditional context:\n${details.trim()}`
      : `Create a persona for: ${name.trim()}`;

    const raw = await this.callLlm(providerId, key, userPrompt);
    const payload = this.parsePayload(raw);
    const record = this.toRecord(payload, name, details, providerId);
    this.store.save(record);
    return record;
  }

  private resolveGenerationProvider(): ProviderId {
    const sole = this.personaRouting.soleAvailableProvider();
    if (sole) return sole;
    if (this.keyVault.getKeyForProvider('gemini')) return 'gemini';
    if (this.keyVault.getKeyForProvider('groq')) return 'groq';
    return 'gemini';
  }

  private async callLlm(
    providerId: ProviderId,
    key: string,
    userPrompt: string,
  ): Promise<string> {
    const AdapterClass = this.adapterFactory(providerId);
    const adapter: ProviderPort = new (
      AdapterClass as unknown as new () => ProviderPort
    )();
    const model = this.modelSelection.getModelFor(providerId);
    const controller = new AbortController();
    let accumulated = '';
    let errorText: string | undefined;

    try {
      for await (const chunk of adapter.streamChat(
        {
          messages: [
            { role: 'system', content: GENERATION_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          model,
          temperature: 0.5,
          maxOutputTokens: 3000,
        },
        key,
        controller.signal,
      )) {
        if (chunk.type === 'delta' && chunk.text) {
          accumulated += chunk.text;
        } else if (chunk.type === 'error') {
          errorText = chunk.meta?.error ?? 'unknown';
          break;
        } else if (chunk.type === 'done') {
          break;
        }
      }
    } catch {
      throw new CustomPersonaGenerationError(
        'Provider request failed.',
        'provider_error',
      );
    }

    if (errorText) {
      throw new CustomPersonaGenerationError(
        `Provider error: ${errorText}`,
        'provider_error',
      );
    }

    if (!accumulated.trim()) {
      throw new CustomPersonaGenerationError(
        'Empty response from provider.',
        'provider_error',
      );
    }

    return accumulated;
  }

  private parsePayload(raw: string): GeneratedCustomPersonaPayload {
    const trimmed = raw.trim();
    const jsonText = extractJson(trimmed);
    try {
      return JSON.parse(jsonText) as GeneratedCustomPersonaPayload;
    } catch {
      throw new CustomPersonaGenerationError(
        'Could not parse persona JSON.',
        'invalid_json',
      );
    }
  }

  private toRecord(
    payload: GeneratedCustomPersonaPayload,
    name: string,
    details: string | undefined,
    providerId: ProviderId,
  ): CustomPersonaRecord {
    if (!payload?.prompt || typeof payload.fullDisplayName !== 'string') {
      throw new CustomPersonaGenerationError(
        'Missing required persona fields.',
        'validation',
      );
    }

    const era = VALID_ERAS.includes(payload.era) ? payload.era : '20th century';
    const disclaimerTier = VALID_TIERS.includes(payload.disclaimerTier)
      ? payload.disclaimerTier
      : 'historical';

    return {
      id: newCustomPersonaId(),
      createdAt: new Date().toISOString(),
      fullDisplayName: clamp(payload.fullDisplayName, 200),
      tagline: clamp(payload.tagline ?? '', 200),
      era,
      disclaimerTier,
      greeting: clamp(payload.greeting, MAX_FIELD_CHARS),
      inputPlaceholder: clamp(
        payload.inputPlaceholder ?? `Ask ${name.trim()}…`,
        200,
      ),
      starterQuestions: (payload.starterQuestions ?? [])
        .slice(0, 3)
        .map((q) => clamp(String(q), 200)),
      providerId,
      prompt: {
        identityBlock: clamp(payload.prompt.identityBlock, MAX_FIELD_CHARS),
        voiceRules: clamp(payload.prompt.voiceRules, MAX_FIELD_CHARS),
        refusalRules: clamp(payload.prompt.refusalRules, MAX_FIELD_CHARS),
        voiceReminder: clamp(payload.prompt.voiceReminder, MAX_FIELD_CHARS),
        fewShots: (payload.prompt.fewShots ?? []).slice(0, 4).map((fs) => ({
          user: clamp(String(fs.user), 500),
          assistant: clamp(String(fs.assistant), MAX_FIELD_CHARS),
        })),
        driftRefresh: clamp(payload.prompt.driftRefresh, MAX_FIELD_CHARS),
        selfVerificationChecklist: clamp(
          payload.prompt.selfVerificationChecklist,
          MAX_FIELD_CHARS,
        ),
      },
      sourceInput: { name: name.trim(), details: details?.trim() },
    };
  }
}

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) return fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

function clamp(value: string, max: number): string {
  const v = value?.trim() ?? '';
  return v.length > max ? v.slice(0, max) : v;
}
