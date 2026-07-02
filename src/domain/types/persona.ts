/**
 * PersonaId — discriminated union of every supported persona.
 *
 * AD-7: persona-specific behavior branches on PersonaId via `switch` +
 * `assertNever` default. Never string-compare persona values.
 */
export type PersonaId = 'hitesh' | 'piyush';

/**
 * assertNever — exhaustiveness helper for discriminated-union switches.
 *
 * Compile-time: TypeScript will refuse to call `assertNever(x)` unless every
 * variant of the union has been handled in prior `case` arms (x narrows to
 * `never` only then).
 * Runtime: throws immediately with the offending value serialised, so any
 * missed variant fails loudly instead of silently no-op'ing.
 */
export function assertNever(x: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(x)}`);
}
