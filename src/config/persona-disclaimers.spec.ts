import { describe, it, expect } from 'vitest';

import { PERSONA_IDS } from '../domain/types/persona';
import { personaChatDisclaimer } from './persona-disclaimers';

describe('personaChatDisclaimer (V2 legal framing)', () => {
  it('covers all seven personas with non-empty parody disclaimers', () => {
    for (const id of PERSONA_IDS) {
      const text = personaChatDisclaimer(id);
      expect(text.length).toBeGreaterThan(40);
      expect(text).toMatch(/AI (parody|simulation)/i);
    }
  });

  it('uses the strong contemporary disclaimer for Musk', () => {
    expect(personaChatDisclaimer('musk')).toMatch(/NOT the real Elon Musk/i);
    expect(personaChatDisclaimer('musk')).toMatch(/financial advice/i);
  });

  it('uses the deceased-recent Jobs disclaimer with dates and Apple', () => {
    expect(personaChatDisclaimer('jobs')).toMatch(/1955-2011/);
    expect(personaChatDisclaimer('jobs')).toMatch(/Apple/i);
  });

  it('uses historical framing for Gandhi, Einstein, and Newton', () => {
    for (const id of ['gandhi', 'einstein', 'newton'] as const) {
      expect(personaChatDisclaimer(id)).toMatch(/historically authoritative/i);
    }
  });

  it('preserves cohort framing for Hitesh and Piyush', () => {
    expect(personaChatDisclaimer('hitesh')).toMatch(/ChaiCode cohort/i);
    expect(personaChatDisclaimer('piyush')).toMatch(/ChaiCode cohort/i);
  });
});
