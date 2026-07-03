import type { ProviderId } from './provider-registry';
import { PROVIDER_DEFAULT_MODELS } from './provider-registry';

const trimEnv = (value: string | undefined): string | undefined => {
  const raw = value?.trim();
  return raw && raw.length > 0 ? raw : undefined;
};

/** Build-time Gemini key from `NG_APP_GEMINI_API_KEY` (baked into the bundle). */
export const BUILD_TIME_GEMINI_API_KEY = trimEnv(
  import.meta.env.NG_APP_GEMINI_API_KEY,
);

/** Build-time Groq key from `NG_APP_GROQ_API_KEY` (baked into the bundle). */
export const BUILD_TIME_GROQ_API_KEY = trimEnv(
  import.meta.env.NG_APP_GROQ_API_KEY,
);

/** Build-time Gemini model from `NG_APP_GEMINI_MODEL`. */
export const BUILD_TIME_GEMINI_MODEL = trimEnv(
  import.meta.env.NG_APP_GEMINI_MODEL,
);

/** Build-time Groq model from `NG_APP_GROQ_MODEL`. */
export const BUILD_TIME_GROQ_MODEL = trimEnv(import.meta.env.NG_APP_GROQ_MODEL);

const BUILD_TIME_KEYS: Record<ProviderId, string | undefined> = {
  gemini: BUILD_TIME_GEMINI_API_KEY,
  groq: BUILD_TIME_GROQ_API_KEY,
};

const BUILD_TIME_MODELS: Record<ProviderId, string | undefined> = {
  gemini: BUILD_TIME_GEMINI_MODEL,
  groq: BUILD_TIME_GROQ_MODEL,
};

export function buildTimeKeyForProvider(
  provider: ProviderId,
): string | undefined {
  return BUILD_TIME_KEYS[provider];
}

export function buildTimeModelForProvider(provider: ProviderId): string {
  return (
    BUILD_TIME_MODELS[provider] ?? PROVIDER_DEFAULT_MODELS[provider]
  );
}
