export type PersonaId =
  | 'hitesh'
  | 'piyush'
  | 'musk'
  | 'jobs'
  | 'gandhi'
  | 'einstein'
  | 'newton';

export const PERSONA_IDS: readonly PersonaId[] = [
  'hitesh',
  'piyush',
  'musk',
  'jobs',
  'gandhi',
  'einstein',
  'newton',
] as const;

export function isPersonaId(value: string): value is PersonaId {
  return (PERSONA_IDS as readonly string[]).includes(value);
}

export function assertNever(x: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(x)}`);
}
