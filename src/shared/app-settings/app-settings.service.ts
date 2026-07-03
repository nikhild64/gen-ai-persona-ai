import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Global settings modal state — owned by `AppHeaderComponent` so the key
 * status badge and gear affordance live in the app chrome on every route.
 */
@Injectable({ providedIn: 'root' })
export class AppSettingsService {
  readonly open = signal(false);
  readonly autoOpenMode = signal(false);

  private readonly savedSubject = new Subject<void>();
  private readonly dismissedSubject = new Subject<boolean>();

  /** Fires after the user saves a key while the modal is open. */
  readonly saved$ = this.savedSubject.asObservable();

  /** Fires with `wasAuto` when the modal closes without a save. */
  readonly dismissed$ = this.dismissedSubject.asObservable();

  openSettings(opts?: { auto?: boolean }): void {
    this.autoOpenMode.set(opts?.auto ?? false);
    this.open.set(true);
  }

  notifySaved(): void {
    this.savedSubject.next();
  }

  notifyDismissed(): void {
    const wasAuto = this.autoOpenMode();
    this.autoOpenMode.set(false);
    this.open.set(false);
    this.dismissedSubject.next(wasAuto);
  }
}
