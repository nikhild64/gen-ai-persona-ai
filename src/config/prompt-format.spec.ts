import { describe, it, expect } from 'vitest';

import {
  ASK_BOTH_SYSTEM_NOTE_TEMPLATE,
  ASK_BOTH_KEEP_GOING_SYSTEM_NOTE_TEMPLATE,
} from './prompt-format';

describe('prompt-format (AD-13 templates)', () => {
  it('renders ASK_BOTH_SYSTEM_NOTE_TEMPLATE with byte-exact v1 form', () => {
    expect(ASK_BOTH_SYSTEM_NOTE_TEMPLATE('Hitesh', 'sample text')).toBe(
      '[System note: Hitesh just said the following to the user:\n\nsample text]',
    );
  });

  it('renders ASK_BOTH_KEEP_GOING_SYSTEM_NOTE_TEMPLATE with all three slots', () => {
    const out = ASK_BOTH_KEEP_GOING_SYSTEM_NOTE_TEMPLATE('U', 'A', 'B');
    expect(out).toContain(
      "[System note: The user's original message was:\n\nU",
    );
    expect(out).toContain('Persona A said:\n\nA');
    expect(out).toContain('Persona B said:\n\nB');
    expect(out).toContain(
      "Respond to Persona B's angle while addressing the user.",
    );
  });
});
