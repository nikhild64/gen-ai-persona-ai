import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

import { STORAGE_PORT } from '../../domain/chat/di-tokens';

/**
 * FR-15 — clears all three chat threads then navigates back to landing.
 * `chat:ask-both:v1` is deleted defensively; Epic 9 populates that key
 * eventually, but deleting a missing key is a no-op.
 */
@Injectable({ providedIn: 'root' })
export class StartNewSessionService {
  private readonly storage = inject(STORAGE_PORT);
  private readonly router = inject(Router);

  async clearAllThreads(): Promise<void> {
    await this.storage.delete('chat:hitesh:v1');
    await this.storage.delete('chat:piyush:v1');
    await this.storage.delete('chat:ask-both:v1');
  }

  async clearAndReturnHome(): Promise<void> {
    await this.clearAllThreads();
    await this.router.navigateByUrl('/');
  }
}
