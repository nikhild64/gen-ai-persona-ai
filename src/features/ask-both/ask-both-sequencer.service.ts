import {
  Injectable,
  inject,
  signal,
  computed,
  type Signal,
  type WritableSignal,
} from '@angular/core';

import type { PersonaId } from '../../domain/types/persona';
import type {
  ChatChunk,
  Message,
  Thread,
} from '../../domain/types/message';
import type { ProviderPort } from '../../domain/ports/provider.port';
import { KEEP_GOING_ROUNDS } from '../../config/context-config';
import { ASK_BOTH_MODE as ASK_BOTH_MODE_SELECTOR } from '../../config/feature-flags';
import {
  ASK_BOTH_SYSTEM_NOTE_TEMPLATE,
  ASK_BOTH_KEEP_GOING_SYSTEM_NOTE_TEMPLATE,
} from '../../config/prompt-format';
import { PERSONA_REGISTRY, personaDisplayName } from '../../personas/persona.registry';
import { PromptAssembler } from '../../domain/prompts/prompt-assembler.service';
import { KeyVaultService } from '../../domain/key-vault/key-vault.service';
import { getProviderAdapter } from '../../infrastructure/providers/provider.registry';
import {
  STORAGE_PORT,
  MODERATION_PORT,
  ANALYTICS_PORT,
} from '../../domain/chat/di-tokens';
import { PRODUCT_COPY } from '../../config/product-copy';

/**
 * AD-13 Ask-Both sequencer. Owns the Sequential-With-Awareness flow
 * (Hitesh → Piyush-with-system-note), the shared AbortController per
 * user turn (AD-14), and — via `keepGoing()` — the one-round follow-up
 * per AD-9 `KEEP_GOING_ROUNDS`. Parallel mode is the FR-31 fallback.
 */
@Injectable({ providedIn: 'root' })
export class AskBothSequencerService {
  readonly inFlight: WritableSignal<boolean> = signal(false);
  readonly currentPersona: WritableSignal<PersonaId | null> = signal(null);
  readonly currentText: WritableSignal<string> = signal('');
  readonly bridgeAnnouncement: WritableSignal<string | null> = signal(null);
  readonly keepGoingUsed: WritableSignal<number> = signal(0);

  readonly canKeepGoing: Signal<boolean> = computed(
    () =>
      !this.inFlight() &&
      this.keepGoingUsed() < KEEP_GOING_ROUNDS &&
      this.hasCompletedTurn(),
  );

  readonly activePersona: Signal<PersonaId | null> = this.currentPersona.asReadonly();

  readonly currentStreaming: Signal<Message | null> = computed(() => {
    if (!this.inFlight() && !this.currentText()) return null;
    const persona = this.currentPersona();
    if (!persona) return null;
    const text = this.currentText();
    if (!text) return null;
    return {
      id: 'streaming',
      role: 'assistant',
      persona,
      content: text,
      timestamp: Date.now(),
      status: 'streaming',
    };
  });

  private readonly storage = inject(STORAGE_PORT);
  private readonly moderation = inject(MODERATION_PORT);
  private readonly analytics = inject(ANALYTICS_PORT);
  private readonly assembler = inject(PromptAssembler);
  private readonly keyVault = inject(KeyVaultService);
  private controller: AbortController | null = null;
  private lastUserMessage: string | null = null;

  async askBoth(userText: string): Promise<void> {
    if (this.inFlight()) return;

    // AD-12 input moderation
    const inputVerdict = await this.moderation.check(userText, 'input');
    if (!inputVerdict.allowed) {
      this.analytics.emit({
        name: 'moderation_blocked',
        payload: { direction: 'input', category: inputVerdict.category },
      });
      return;
    }

    // AD-13 fire-once analytics per turn
    this.analytics.emit({
      name: 'ask_both_message_sent',
      payload: { charCount: userText.length },
    });

    const thread = await this.getOrCreateThread();
    const userMsg: Message = {
      id: this.uuid(),
      role: 'user',
      content: userText,
      timestamp: Date.now(),
    };
    thread.messages.push(userMsg);
    thread.updatedAt = userMsg.timestamp;
    await this.storage.set('chat:ask-both:v1', thread);
    this.lastUserMessage = userText;
    this.keepGoingUsed.set(0);
    this.bridgeAnnouncement.set(null);

    this.inFlight.set(true);
    this.controller = new AbortController();

    if (ASK_BOTH_MODE_SELECTOR === 'parallel') {
      await this.dispatchParallel(thread);
    } else {
      await this.dispatchSequential(thread);
    }

    this.inFlight.set(false);
    this.currentPersona.set(null);
    this.currentText.set('');
    this.controller = null;
  }

  async keepGoing(): Promise<void> {
    if (this.inFlight()) return;
    if (this.keepGoingUsed() >= KEEP_GOING_ROUNDS) return;
    if (!this.hasCompletedTurn()) return;

    const thread = await this.storage.get<Thread>('chat:ask-both:v1');
    if (!thread) return;

    this.analytics.emit({
      name: 'keep_going_clicked',
      payload: {},
    });
    this.inFlight.set(true);
    this.controller = new AbortController();

    const [hiteshLast, piyushLast] = this.lastTwoAssistantTexts(thread);
    const systemNote = ASK_BOTH_KEEP_GOING_SYSTEM_NOTE_TEMPLATE(
      this.lastUserMessage ?? '',
      hiteshLast,
      piyushLast,
    );

    // A keep-going round: Hitesh responds to Piyush's take.
    await this.streamPersona(
      'hitesh',
      thread,
      'ask-both-keep-going',
      systemNote,
    );

    this.keepGoingUsed.update((n) => n + 1);
    this.inFlight.set(false);
    this.currentPersona.set(null);
    this.currentText.set('');
    this.controller = null;
  }

  cancel(): void {
    this.controller?.abort();
    this.controller = null;
    this.inFlight.set(false);
  }

  private async dispatchSequential(thread: Thread): Promise<void> {
    // Persona A — Hitesh
    const hiteshResult = await this.streamPersona(
      'hitesh',
      thread,
      'ask-both-a',
      undefined,
    );
    if (hiteshResult.errored) return; // FR-27: Persona A error blocks Persona B

    // AD-20 bridge announcement (E9-S3): announce the transition to Piyush.
    this.bridgeAnnouncement.set(PRODUCT_COPY.askBothBridgeAnnouncement);

    // Persona B — Piyush (invoked even on Hitesh in-character refusal).
    const systemNote = ASK_BOTH_SYSTEM_NOTE_TEMPLATE(
      personaDisplayName('hitesh'),
      hiteshResult.text,
    );
    await this.streamPersona('piyush', thread, 'ask-both-b', systemNote);
  }

  private async dispatchParallel(thread: Thread): Promise<void> {
    // E9-S4 fallback — fire both providers concurrently, no system-note.
    this.analytics.emit({
      name: 'parallel_fallback_triggered',
      payload: {},
    });
    await Promise.all([
      this.streamPersona('hitesh', thread, 'ask-both-a', undefined),
      this.streamPersona('piyush', thread, 'ask-both-a', undefined),
    ]);
  }

  private async streamPersona(
    persona: PersonaId,
    thread: Thread,
    mode: 'ask-both-a' | 'ask-both-b' | 'ask-both-keep-going',
    systemNote: string | undefined,
  ): Promise<{ text: string; errored: boolean }> {
    this.currentPersona.set(persona);
    this.currentText.set('');

    const providerId = PERSONA_REGISTRY[persona].providerId;
    const key = this.keyVault.getKeyForProvider(providerId);
    if (!key) {
      return { text: '', errored: true };
    }

    const AdapterClass = getProviderAdapter(providerId);
    const adapter: ProviderPort = new (
      AdapterClass as unknown as new () => ProviderPort
    )();

    const prompt = this.assembler.compose(persona, thread, mode, { systemNote });
    let accumulated = '';
    let errored = false;
    let doneChunk: ChatChunk | null = null;

    try {
      for await (const chunk of adapter.streamChat(
        prompt,
        key,
        this.controller!.signal,
      )) {
        if (chunk.type === 'delta' && chunk.text) {
          accumulated += chunk.text;
          this.currentText.set(accumulated);
        } else if (chunk.type === 'done') {
          doneChunk = chunk;
          break;
        } else if (chunk.type === 'error') {
          errored = true;
          break;
        }
      }
    } catch {
      errored = true;
    }

    if (!errored && doneChunk) {
      const outputVerdict = await this.moderation.check(accumulated, 'output');
      let finalText = accumulated;
      if (!outputVerdict.allowed) {
        finalText = this.pickRefusalTemplate(
          persona,
          outputVerdict.category,
          outputVerdict.suggested_refusal,
        );
        this.analytics.emit({
          name: 'moderation_blocked',
          payload: { direction: 'output', category: outputVerdict.category },
        });
      }
      const msg: Message = {
        id: this.uuid(),
        role: 'assistant',
        persona,
        content: finalText,
        timestamp: Date.now(),
        status: 'complete',
      };
      thread.messages.push(msg);
      thread.updatedAt = msg.timestamp;
      await this.storage.set('chat:ask-both:v1', thread);
      return { text: finalText, errored: false };
    }

    return { text: accumulated, errored };
  }

  private pickRefusalTemplate(
    persona: PersonaId,
    category?: string,
    suggested?: string,
  ): string {
    const p = PERSONA_REGISTRY[persona].prompt;
    switch (category) {
      case 'jailbreak':
        return p.promptInjectionTemplate || suggested || '';
      case 'off_domain':
        return p.offDomainTemplate || suggested || '';
      case 'adult':
        return p.adultTemplate || suggested || '';
      case 'political':
        return p.politicalTemplate || suggested || '';
      case 'hate':
      case 'self_harm':
        return p.hostileUserTemplate || suggested || '';
      default:
        return suggested || p.offDomainTemplate || '';
    }
  }

  private hasCompletedTurn(): boolean {
    return this.lastUserMessage !== null;
  }

  private async getOrCreateThread(): Promise<Thread> {
    const existing = await this.storage.get<Thread>('chat:ask-both:v1');
    if (existing) return existing;
    return {
      id: this.uuid(),
      scope: 'ask-both',
      messages: [],
      rollingSummary: null,
      turnsSinceLastSummary: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private lastTwoAssistantTexts(thread: Thread): [string, string] {
    const assistants = thread.messages.filter((m) => m.role === 'assistant');
    const piyush =
      [...assistants].reverse().find((m) => m.persona === 'piyush')?.content ??
      '';
    const hitesh =
      [...assistants].reverse().find((m) => m.persona === 'hitesh')?.content ??
      '';
    return [hitesh, piyush];
  }

  private uuid(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  }
}
