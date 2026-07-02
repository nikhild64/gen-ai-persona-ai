/**
 * AD-19 — persona signature-phrase regexes. OBSERVATION ONLY. A miss triggers
 * an `AnalyticsEvent{ name: 'persona_regex_miss' }` emission. The response is
 * NEVER regenerated automatically; drift is diagnosed manually against the
 * eval drift-curve (E11-S2).
 */
export const HITESH_REGEX =
  /Haanji|chai|samjha kya|yaar|😁|kro|msst|smjh/i;

export const PIYUSH_REGEX =
  /dekho|yaar|baat samajh aayi|OK\?|Hey everyone|kuch nahi hai|theek hai/i;

/**
 * Post-sprint Blended Ask-Both variant. The fused voice should carry AT
 * LEAST ONE signature phrase from EITHER creator — a hard miss on both
 * fires `persona_regex_miss{persona:'blended'}` so drift shows up in the
 * eval slice alongside solo persona misses. No new pattern authored:
 * blended output that satisfies one persona regex is on-voice for that
 * mentor, which is enough calibration for the fused-voice check.
 */
export const hasBlendedSignature = (text: string): boolean =>
  HITESH_REGEX.test(text) || PIYUSH_REGEX.test(text);
