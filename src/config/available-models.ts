import type { ProviderId } from './provider-registry';

export type AvailableModel = {
  /** The exact model id used in the provider's HTTP URL/body. */
  id: string;
  /** Human-readable label shown in the settings dropdown. */
  label: string;
  /** Optional one-line hint about the trade-off (speed vs cost vs quality). */
  hint?: string;
};

/**
 * Curated catalog of models the user can pick per provider. First entry in
 * each list is the recommended default and matches
 * `PROVIDER_DEFAULT_MODELS` in `provider-registry.ts`.
 *
 * Keeping this deliberately small — hallucinating obscure model coordinates
 * would break requests silently. Add entries by looking up the exact model
 * string in each provider's docs before wiring here.
 */
export const AVAILABLE_MODELS: Record<ProviderId, AvailableModel[]> = {
  gemini: [
    {
      id: 'gemini-3.1-flash-lite',
      label: 'Gemini 2.5 Flash',
      hint: 'Fast + cheap · default',
    },
    {
      id: 'gemini-3.1-flash-lite-lite',
      label: 'Gemini 2.5 Flash Lite',
      hint: 'Cheapest · shorter answers',
    },
    {
      id: 'gemini-2.5-pro',
      label: 'Gemini 2.5 Pro',
      hint: 'Smartest · slower',
    },
    {
      id: 'gemini-1.5-flash',
      label: 'Gemini 1.5 Flash',
      hint: 'Older · stable',
    },
  ],
  groq: [
    {
      id: 'openai/gpt-oss-120b',
      label: 'GPT-OSS 120B',
      hint: 'Balanced · default',
    },
    {
      id: 'llama-3.3-70b-versatile',
      label: 'Llama 3.3 70B',
      hint: 'Fast · general',
    },
    {
      id: 'meta-llama/llama-4-maverick-17b-128e-instruct',
      label: 'Llama 4 Maverick 17B',
      hint: 'Newer · long-context',
    },
    {
      id: 'openai/gpt-oss-20b',
      label: 'GPT-OSS 20B',
      hint: 'Small · fastest',
    },
  ],
};
