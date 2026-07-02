import type { Thread } from '../types/message';
import type { PromptMode } from '../prompts/types';
import { assertNever } from '../types/persona';

/**
 * AD-9 single-source turn-counting helpers. Every consumer that needs to
 * know how many assistant messages a turn produces (E7-S1 max-turn cap,
 * E9-S2 Ask-Both sequencer, E11 eval budgeting) imports from here.
 */

export function assistantMessageCount(thread: Thread): number {
  return thread.messages.filter((m) => m.role === 'assistant').length;
}

export function expectedAssistantMessagesForMode(mode: PromptMode): number {
  switch (mode) {
    case 'solo':
      return 1;
    case 'ask-both-a':
      return 2; // A + B are counted together as a single Ask-Both turn
    case 'ask-both-b':
      return 0; // subsumed by ask-both-a
    case 'ask-both-keep-going':
      return 1; // one additional round on top of the already-counted A+B
    case 'ask-both-blended':
      return 1; // single fused-voice bubble per turn (one LLM call, one message)
    case 'summarize':
      return 0; // background operation — does not count toward user cap
    default:
      return assertNever(mode);
  }
}
