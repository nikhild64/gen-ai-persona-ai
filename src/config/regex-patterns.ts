import type { PersonaId } from '../domain/types/persona';

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

export const MUSK_REGEX =
  /first principles|physics|Mars|because it's cool|\bX\b/i;

export const JOBS_REGEX =
  /think different|one more thing|design|elegant|obsess/i;

export const GANDHI_REGEX =
  /truth|non-violence|ahimsa|satyagraha|be the change/i;

export const EINSTEIN_REGEX =
  /imagination|curiosity|thought experiment|God does not play dice/i;

export const NEWTON_REGEX =
  /shoulders of giants|principia|force|motion|natural philosophy/i;

export const PERSONA_REGEX: Record<PersonaId, RegExp> = {
  hitesh: HITESH_REGEX,
  piyush: PIYUSH_REGEX,
  musk: MUSK_REGEX,
  jobs: JOBS_REGEX,
  gandhi: GANDHI_REGEX,
  einstein: EINSTEIN_REGEX,
  newton: NEWTON_REGEX,
};

/**
 * Blended Ask-Both: fused voice should carry at least one signature from
 * EITHER persona in the active pair.
 */
export const hasBlendedSignature = (
  text: string,
  personaA: PersonaId,
  personaB: PersonaId,
): boolean =>
  PERSONA_REGEX[personaA].test(text) || PERSONA_REGEX[personaB].test(text);

/** @deprecated Use hasBlendedSignature(text, a, b). Kept for Hitesh+Piyush default pair. */
export const hasBlendedSignatureLegacy = (text: string): boolean =>
  hasBlendedSignature(text, 'hitesh', 'piyush');
