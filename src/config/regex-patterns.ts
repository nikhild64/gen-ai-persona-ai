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
