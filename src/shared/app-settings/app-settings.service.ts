import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

export type AppSettingsCloseReason = { wasAuto: boolean };

/**
 * Single settings-modal surface for the app shell header. Feature routes
 * open settings through here instead of embedding their own modals.
 */
@Injectable({ providedIn: 'root' })
export class AppSettingsService {
  readonly open = signal(false);
  readonly autoOpenMode = signal(false);

  private readonly savedSubject = new Subject<AppSettingsCloseReason>();
  private readonly dismissedSubject = new Subject<void>();

  readonly saved$ = this.savedSubject.asObservable();
  readonly dismissed$ = this.dismissedSubject.asObservable();

  openSettings(options?: { auto?: boolean }): void {
    this.autoOpenMode.set(options?.auto ?? false);
    this.open.set(true);
  }

  notifySaved(): void {
    const wasAuto = this.autoOpenMode();
    this.autoOpenMode.set(false);
    this.savedSubject.next({ wasAuto });
  }

  notifyDismissed(): void {
    this.autoOpenMode.set(false);
    this.dismissedSubject.next();
  }
}
