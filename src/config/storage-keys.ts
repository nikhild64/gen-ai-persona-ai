/**
 * STUB — this stays as `string` in E0-S2 to let `StoragePort` compile.
 * E0-S3 will tighten this to a closed union per AD-6:
 *   `chat:threads:v1` | `chat:activeThreadId:v1` | `chat:activePersona:v1` | ...
 */
export type StorageKey = string;
