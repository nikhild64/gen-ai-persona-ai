import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';

import { STORAGE_PORT } from '../../domain/chat/di-tokens';
import { ChatOrchestrator } from '../../domain/chat/chat-orchestrator.service';
import { AskBothSequencerService } from '../../features/ask-both/ask-both-sequencer.service';

/**
 * FR-15 — clears all three chat threads. Components subscribe to
 * `sessionCleared$` to re-seed UI on the current route instead of navigating away.
 */
@Injectable({ providedIn: 'root' })
export class StartNewSessionService {
  private readonly storage = inject(STORAGE_PORT);
  private readonly orchestrator = inject(ChatOrchestrator);
  private readonly askBothSequencer = inject(AskBothSequencerService);
  private readonly cleared$ = new Subject<void>();

  /** Fires after threads are wiped and orchestrator state is reset. */
  readonly sessionCleared$ = this.cleared$.asObservable();

  async clearAllThreads(): Promise<void> {
    await this.storage.delete('chat:hitesh:v1');
    await this.storage.delete('chat:piyush:v1');
    await this.storage.delete('chat:ask-both:v1');
    this.orchestrator.resetSessionState();
    this.askBothSequencer.resetSessionState();
  }

  /** Clear history and notify the active chat surface to re-seed in place. */
  async clearInPlace(): Promise<void> {
    await this.clearAllThreads();
    this.cleared$.next();
  }
}
