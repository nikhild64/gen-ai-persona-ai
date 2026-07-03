import { describe, it, expect } from 'vitest';

import { assertNever, type PersonaId } from './persona';

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
        case 'hitesh':
          return 'hitesh';
        case 'piyush':
          return 'piyush';
        default:
          return assertNever(persona);
      }
    };

    expect(runSwitch(pickPersona('hitesh'))).toBe('hitesh');
    expect(runSwitch(pickPersona('piyush'))).toBe('piyush');
  });
});
