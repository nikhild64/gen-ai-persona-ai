import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

import { STORAGE_PORT } from '../../domain/chat/di-tokens';
import { ChatOrchestrator } from '../../domain/chat/chat-orchestrator.service';
import { AskBothSequencerService } from '../../features/ask-both/ask-both-sequencer.service';

/**
 * FR-15 — clears all three chat threads then navigates back to landing.
 * `chat:ask-both:v1` is deleted defensively; Epic 9 populates that key
 * eventually, but deleting a missing key is a no-op.
 */
@Injectable({ providedIn: 'root' })
export class StartNewSessionService {
  private readonly storage = inject(STORAGE_PORT);
  private readonly router = inject(Router);
  private readonly orchestrator = inject(ChatOrchestrator);
  private readonly askBothSequencer = inject(AskBothSequencerService);

  async clearAllThreads(): Promise<void> {
    await this.storage.delete('chat:hitesh:v1');
    await this.storage.delete('chat:piyush:v1');
    await this.storage.delete('chat:ask-both:v1');
    this.orchestrator.resetSessionState();
    this.askBothSequencer.resetSessionState();
  }

  async clearAndReturnHome(): Promise<void> {
    await this.clearAllThreads();
    await this.router.navigateByUrl('/');
  }
}
