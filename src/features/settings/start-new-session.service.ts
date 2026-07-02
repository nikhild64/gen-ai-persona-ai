import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

import { STORAGE_PORT } from '../../domain/chat/di-tokens';
import { CHAT_STORAGE_KEYS } from '../../config/storage-keys';
import { PERSONA_IDS } from '../../domain/types/persona';

/**
 * FR-15 — clears all chat threads then navigates back to landing.
 */
@Injectable({ providedIn: 'root' })
export class StartNewSessionService {
  private readonly storage = inject(STORAGE_PORT);
  private readonly router = inject(Router);

  async clearAllThreads(): Promise<void> {
    for (const id of PERSONA_IDS) {
      await this.storage.delete(CHAT_STORAGE_KEYS[id]);
    }
    await this.storage.delete('chat:ask-both:v1');
  }

  async clearAndReturnHome(): Promise<void> {
    await this.clearAllThreads();
    await this.router.navigateByUrl('/');
  }
}
