import type { PersonaId } from '../domain/types/persona';

/**
 * AD-6 — closed StorageKey union. Every IndexedDB / localStorage read and
 * write goes through StoragePort with one of these keys. Adding a new key is
 * an AD update; there is no `| string` escape hatch.
 */
export type StorageKey =
  | 'chat:hitesh:v1'
  | 'chat:piyush:v1'
  | 'chat:musk:v1'
  | 'chat:jobs:v1'
  | 'chat:gandhi:v1'
  | 'chat:einstein:v1'
  | 'chat:newton:v1'
  | 'chat:ask-both:v1'
  | 'settings:v1'
  | 'settings:ask-both-mode:v1'
  | 'settings:blended-pair:v1';

/** Solo chat thread keys keyed by persona id (V2 — 7 personas). */
export const CHAT_STORAGE_KEYS: Record<PersonaId, StorageKey> = {
  musk: 'chat:musk:v1',
  jobs: 'chat:jobs:v1',
  gandhi: 'chat:gandhi:v1',
  einstein: 'chat:einstein:v1',
  newton: 'chat:newton:v1',
};
