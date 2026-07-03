/**
 * AD-11 key-shape redaction patterns. Kept independent of adapter modules
 * to avoid circular imports (adapters call `scrubSecrets` on error paths).
 * Keep in sync with each adapter's `KEY_PATTERN` (anchors stripped).
 */
const REDACTION_RULES: Array<{ providerId: string; pattern: RegExp }> = [
  { providerId: 'gemini', pattern: /AIza[0-9A-Za-z_-]{35}/g },
  { providerId: 'groq', pattern: /gsk_[0-9A-Za-z]{52}/g },
];

/** AD-11 — strip provider API key shapes from arbitrary log/analytics text. */
export function scrubSecrets(text: string): string {
  let out = text;
  for (const { providerId, pattern } of REDACTION_RULES) {
    out = out.replace(pattern, `[REDACTED-${providerId}-KEY]`);
  }
  return out;
}
