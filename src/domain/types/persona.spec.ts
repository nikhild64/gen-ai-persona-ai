import { describe, it, expect } from 'vitest';

import { assertNever, type PersonaId, PERSONA_IDS } from './persona';

describe('assertNever', () => {
  it('throws when reached at runtime with an unknown variant', () => {
    const rogue = 'unknown-persona' as unknown as never;
    expect(() => assertNever(rogue)).toThrowError(
      /Unhandled variant: "unknown-persona"/,
    );
  });

  it('serialises non-string variants in the thrown message', () => {
    const rogue = { kind: 'ghost' } as unknown as never;
    expect(() => assertNever(rogue)).toThrowError(/"kind":"ghost"/);
  });

  it('is unreachable when every PersonaId variant is handled', () => {
    const pickPersona = (which: PersonaId): PersonaId => which;
    const runSwitch = (persona: PersonaId): string => {
      switch (persona) {
        case 'musk':
          return 'musk';
        case 'jobs':
          return 'jobs';
        case 'gandhi':
          return 'gandhi';
        case 'einstein':
          return 'einstein';
        case 'newton':
          return 'newton';
        default:
          return assertNever(persona);
      }
    };

    for (const id of PERSONA_IDS) {
      expect(runSwitch(pickPersona(id))).toBe(id);
    }
  });
});
