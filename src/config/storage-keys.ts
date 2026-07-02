/**
 * AD-6 — closed StorageKey union. Every IndexedDB / sessionStorage read and
 * write goes through StoragePort with one of these keys. Adding a new key is
 * an AD update; there is no `| string` escape hatch.
 */
export type StorageKey =
  | 'chat:hitesh:v1'
  | 'chat:piyush:v1'
  | 'chat:ask-both:v1'
  | 'settings:v1';
