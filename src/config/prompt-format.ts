/**
 * AD-13 — Ask-Both system-note templates. These are the ONLY prompt strings
 * that live in `src/config/`; the persona voice text stays in
 * `src/personas/*.prompt.ts` per AD-22.
 */

export const ASK_BOTH_SYSTEM_NOTE_TEMPLATE = (
  personaName: string,
  priorText: string,
): string =>
  `[System note: ${personaName} just said the following to the user:\n\n${priorText}]`;

export const ASK_BOTH_KEEP_GOING_SYSTEM_NOTE_TEMPLATE = (
  userMessage: string,
  personaAText: string,
  personaBText: string,
): string =>
  `[System note: The user's original message was:\n\n${userMessage}\n\n` +
  `Persona A said:\n\n${personaAText}\n\nPersona B said:\n\n${personaBText}\n\n` +
  `Respond to Persona B's angle while addressing the user.]`;
