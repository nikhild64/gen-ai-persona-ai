import {
  Injectable,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';

import { ASK_BOTH_MODE, type AskBothMode } from '../../config/feature-flags';
import type { StorageKey } from '../../config/storage-keys';
import { localStoreGet, localStoreSet } from '../../domain/key-vault/browser-local-storage';

/**
 * Post-sprint Blended Ask-Both variant support. User-selectable
 * Ask-Both variant (Sequential | Parallel | Blended), persisted to
 * localStorage — same lifecycle as BYO-Key vault (AD-11), so the
 * selection survives browser restarts.
 *
 * The build-time `ASK_BOTH_MODE` flag (`src/config/feature-flags.ts`)
 * stays authoritative for FRESH sessions with no persisted preference —
 * flag semantics preserved per the post-sprint constraint. Once the user
 * clicks the mode toggle, their stored value wins until changed.
 *
 * `AskBothSequencerService` consumes `.get()` on every send, so mid-thread
 * mode switches take effect for the NEXT message only (per AC-1).
 */
@Injectable({ providedIn: 'root' })
export class AskBothModeService {
  private static readonly STORAGE_KEY: StorageKey = 'settings:ask-both-mode:v1';

  private readonly _mode: WritableSignal<AskBothMode> = signal<AskBothMode>(
    this.readInitial(),
  );

  readonly mode: Signal<AskBothMode> = this._mode.asReadonly();

  get(): AskBothMode {
    return this._mode();
  }

  set(mode: AskBothMode): void {
    if (mode === this._mode()) return;
    this._mode.set(mode);
    this.persist(mode);
  }

  private readInitial(): AskBothMode {
    const stored = this.readRaw();
    if (stored !== null) return stored;
    return ASK_BOTH_MODE;
  }

  private readRaw(): AskBothMode | null {
    try {
      const raw = localStoreGet(AskBothModeService.STORAGE_KEY);
      if (raw === 'sequential' || raw === 'parallel' || raw === 'blended') {
        return raw;
      }
      return null;
    } catch {
      // localStorage unavailable (private mode / SSR) — fall back silently.
      return null;
    }
  }

  private persist(mode: AskBothMode): void {
    try {
      localStoreSet(AskBothModeService.STORAGE_KEY, mode);
    } catch {
      // localStorage unavailable — silently drop (matches KeyVaultService).
    }
  }
}
