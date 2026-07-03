/**
 * AD-6 — closed StorageKey union. Every IndexedDB / sessionStorage read and
 * write goes through StoragePort with one of these keys. Adding a new key is
 * an AD update; there is no `| string` escape hatch.
 *
 * `settings:ask-both-mode:v1` is a sessionStorage-lifetime key (same
 * semantics as AD-11 BYO-Key vault) recording the user's chosen Ask-Both
 * variant (Sequential | Parallel | Blended) so the selection survives
 * within-tab reloads.
 */
export type StorageKey =
  | 'chat:hitesh:v1'
  | 'chat:piyush:v1'
  | 'chat:ask-both:v1'
  | 'settings:v1'
  | 'settings:ask-both-mode:v1'
  | 'settings:persona-routing:v1'
  | 'settings:model-discovery-cache:v1'
  | 'settings:last-active-solo:v1';
