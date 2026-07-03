import type {
  ProviderId,
  ProviderPortAdapterClass,
} from '../../domain/ports/provider.port';
import { GeminiAdapter } from './gemini.adapter';
import { GroqAdapter } from './groq.adapter';

/**
 * AD-3: sole entrypoint through which feature/domain code constructs a
 * `ProviderPort` implementation. ESLint `no-restricted-imports` (E0-S4) bans
 * any file outside `src/infrastructure/` from importing `*.adapter.ts` directly.
 */
export const PROVIDER_REGISTRY: Map<ProviderId, ProviderPortAdapterClass> =
  new Map<ProviderId, ProviderPortAdapterClass>([
    ['gemini', GeminiAdapter as unknown as ProviderPortAdapterClass],
    ['groq', GroqAdapter as unknown as ProviderPortAdapterClass],
  ]);

export function getProviderAdapter(id: ProviderId): ProviderPortAdapterClass {
  const cls = PROVIDER_REGISTRY.get(id);
  if (!cls) {
    throw new Error(`No adapter registered for providerId=${id}`);
  }
  return cls;
}
