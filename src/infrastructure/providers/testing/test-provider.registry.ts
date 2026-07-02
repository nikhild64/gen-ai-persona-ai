import type {
  ProviderId,
  ProviderPortAdapterClass,
} from '../../../domain/ports/provider.port';
import { MockAdapter } from './mock.adapter';

/**
 * Test-only registry — swap PROVIDER_REGISTRY out for this via a fixture in
 * unit tests / eval scripts to keep everything hermetic (no real Gemini or
 * Groq traffic).
 */
export const TEST_PROVIDER_REGISTRY: Map<ProviderId, ProviderPortAdapterClass> =
  new Map<ProviderId, ProviderPortAdapterClass>([
    ['gemini', MockAdapter as unknown as ProviderPortAdapterClass],
    ['groq', MockAdapter as unknown as ProviderPortAdapterClass],
  ]);
