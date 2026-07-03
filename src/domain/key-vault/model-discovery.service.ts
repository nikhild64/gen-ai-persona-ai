import {
  Injectable,
  inject,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';

import type { ProviderId } from '../../config/provider-registry';
import {
  AVAILABLE_MODELS,
  type AvailableModel,
} from '../../config/available-models';
import { KeyVaultService } from './key-vault.service';
import { localStoreGet, localStoreSet } from './browser-local-storage';

const CACHE_KEY = 'model-discovery:v1';

type ProviderModelState = {
  models: AvailableModel[] | null; // null = not yet fetched (use static fallback)
  loading: boolean;
  error: string | null;
  fetchedAt: number | null;
};

type DiscoveryState = Record<ProviderId, ProviderModelState>;

const emptyState = (): ProviderModelState => ({
  models: null,
  loading: false,
  error: null,
  fetchedAt: null,
});

/**
 * Live model discovery via each provider's `/models` endpoint. The curated
 * `AVAILABLE_MODELS` list stays as the instant baseline / offline fallback;
 * once we fetch successfully we prefer the live list. Cached in localStorage
 * so re-opening settings doesn't re-hit the API every time.
 */
@Injectable({ providedIn: 'root' })
export class ModelDiscoveryService {
  private readonly keyVault = inject(KeyVaultService);

  private readonly _state: WritableSignal<DiscoveryState> = signal<
    DiscoveryState
  >({
    gemini: emptyState(),
    groq: emptyState(),
  });

  readonly state: Signal<DiscoveryState> = this._state.asReadonly();

  constructor() {
    this.hydrateFromCache();
  }

  /** Returns live-fetched models when present AND non-empty, otherwise the
   *  static list. `??` alone would treat an empty live array as "present"
   *  and produce a blank dropdown. */
  getModelsFor(provider: ProviderId): AvailableModel[] {
    const live = this._state()[provider].models;
    return live && live.length > 0 ? live : AVAILABLE_MODELS[provider];
  }

  /** Fetches live models for `provider` if we have a key and either haven't
   *  fetched yet OR `force` is true. Pass `keyOverride` to probe a draft
   *  key from the settings input before it is saved. */
  async refresh(
    provider: ProviderId,
    force = false,
    keyOverride?: string,
  ): Promise<void> {
    const key =
      keyOverride?.trim() || this.keyVault.getKeyForProvider(provider);
    if (!key) return;

    const current = this._state()[provider];
    if (current.loading) return;
    if (!force && current.models && current.fetchedAt) return;

    this.patch(provider, { loading: true, error: null });

    try {
      const models = await (provider === 'gemini'
        ? this.fetchGemini(key)
        : this.fetchGroq(key));
      this.patch(provider, {
        models,
        loading: false,
        error: null,
        fetchedAt: Date.now(),
      });
      this.persist();
    } catch (e) {
      const err = e as Error;
      this.patch(provider, {
        loading: false,
        error: err.message || 'Model discovery failed',
      });
    }
  }

  /** Convenience — refresh both providers that currently have a saved key. */
  async refreshAll(force = false): Promise<void> {
    await Promise.all(
      (['gemini', 'groq'] as ProviderId[]).map((p) => this.refresh(p, force)),
    );
  }

  /** Reset live model cache for a provider (e.g. after key cleared). */
  clear(provider: ProviderId): void {
    this.patch(provider, emptyState());
    this.persist();
  }

  private patch(provider: ProviderId, partial: Partial<ProviderModelState>): void {
    this._state.update((current) => ({
      ...current,
      [provider]: { ...current[provider], ...partial },
    }));
  }

  private async fetchGemini(key: string): Promise<AvailableModel[]> {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models',
      { headers: { 'x-goog-api-key': key } },
    );
    if (!res.ok) {
      throw new Error(`Gemini models fetch failed: HTTP ${res.status}`);
    }
    const body = (await res.json()) as {
      models?: Array<{
        name?: string; // "models/gemini-3.1-flash-lite"
        displayName?: string;
        description?: string;
        supportedGenerationMethods?: string[];
      }>;
    };
    const raw = body.models ?? [];
    return raw
      .filter((m) => {
        const name = m.name ?? '';
        // Only chat models. Everything else on the `/models` endpoint
        // (embedding-001, text-embedding-*, aqa, imagen-*, veo-*, learnlm)
        // uses a different name prefix, so the `models/gemini-*` guard is
        // enough.
        if (!name.startsWith('models/gemini-')) return false;
        // Gemini reports `["generateContent", "countTokens"]` for chat
        // models. Streaming is invoked via `?alt=sse` on the same endpoint
        // — there's no separate `streamGenerateContent` method advertised.
        // Require `generateContent` explicitly so we don't accidentally
        // include TTS/image variants that share the gemini- prefix.
        const methods = m.supportedGenerationMethods ?? [];
        return methods.includes('generateContent');
      })
      .map<AvailableModel>((m) => {
        const id = (m.name ?? '').replace(/^models\//, '');
        return {
          id,
          label: m.displayName?.trim() || prettifyId(id),
          hint: shortHint(m.description),
        };
      })
      .sort(byRecommendedGemini);
  }

  private async fetchGroq(key: string): Promise<AvailableModel[]> {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      throw new Error(`Groq models fetch failed: HTTP ${res.status}`);
    }
    const body = (await res.json()) as {
      data?: Array<{
        id?: string;
        object?: string;
        active?: boolean;
        context_window?: number;
        input_modalities?: string[];
        output_modalities?: string[];
      }>;
    };
    const raw = body.data ?? [];
    return raw
      .filter((m) => {
        const id = m.id ?? '';
        if (!id) return false;
        if (m.active === false) return false;
        // Only text-in / text-out chat models. Groq exposes whisper (audio-in),
        // TTS (audio-out), and multimodal-only variants on the same /models
        // endpoint; filtering by modality is more robust than id-substring
        // heuristics for future model additions.
        const inMod = m.input_modalities ?? [];
        const outMod = m.output_modalities ?? [];
        return inMod.includes('text') && outMod.includes('text');
      })
      .map<AvailableModel>((m) => ({
        id: m.id!,
        label: prettifyId(m.id!),
        hint: m.context_window
          ? `Context ${(m.context_window / 1024).toFixed(0)}k`
          : undefined,
      }))
      .sort(byRecommendedGroq);
  }

  private hydrateFromCache(): void {
    try {
      const raw = localStoreGet(CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<
        Record<ProviderId, Pick<ProviderModelState, 'models' | 'fetchedAt'>>
      >;
      (['gemini', 'groq'] as ProviderId[]).forEach((p) => {
        const entry = parsed[p];
        if (entry?.models) {
          this.patch(p, {
            models: entry.models,
            fetchedAt: entry.fetchedAt ?? null,
          });
        }
      });
    } catch {
      /* ignore */
    }
  }

  private persist(): void {
    try {
      const snapshot: Partial<
        Record<ProviderId, Pick<ProviderModelState, 'models' | 'fetchedAt'>>
      > = {};
      (['gemini', 'groq'] as ProviderId[]).forEach((p) => {
        const s = this._state()[p];
        if (s.models)
          snapshot[p] = { models: s.models, fetchedAt: s.fetchedAt };
      });
      localStoreSet(CACHE_KEY, JSON.stringify(snapshot));
    } catch {
      /* ignore */
    }
  }
}

// ---------- helpers ----------

function prettifyId(id: string): string {
  // "gemini-3.1-flash-lite-lite" → "Gemini 2.5 Flash Lite"
  // "openai/gpt-oss-120b"   → "openai/gpt oss 120b" (kept lowercase for
  //                            path-y ids so users can still spot the coord)
  const withoutSlash = id.replace(/[-_]+/g, ' ');
  return withoutSlash
    .split(' ')
    .map((seg) =>
      seg.length > 0 && !seg.includes('/')
        ? seg.charAt(0).toUpperCase() + seg.slice(1)
        : seg,
    )
    .join(' ');
}

function shortHint(description: string | undefined): string | undefined {
  if (!description) return undefined;
  const trimmed = description.trim();
  if (trimmed.length <= 60) return trimmed;
  return `${trimmed.slice(0, 57).trimEnd()}…`;
}

/**
 * Preference: flash-lite < flash < pro, newer generations first. Falls back
 * to alphabetical.
 */
function byRecommendedGemini(a: AvailableModel, b: AvailableModel): number {
  return geminiRank(a.id) - geminiRank(b.id) || a.id.localeCompare(b.id);
}
function geminiRank(id: string): number {
  const gen = id.match(/gemini-(\d)/)?.[1];
  const genRank = gen ? -Number(gen) : 0; // newer first
  let variantRank = 5;
  if (id.includes('flash-lite')) variantRank = 0;
  else if (id.includes('flash')) variantRank = 1;
  else if (id.includes('pro')) variantRank = 2;
  return genRank * 10 + variantRank;
}

function byRecommendedGroq(a: AvailableModel, b: AvailableModel): number {
  // Bias openai/gpt-oss then llama then rest, alphabetical inside each tier.
  return groqRank(a.id) - groqRank(b.id) || a.id.localeCompare(b.id);
}
function groqRank(id: string): number {
  if (id.startsWith('openai/gpt-oss')) return 0;
  if (id.includes('llama')) return 1;
  return 2;
}
