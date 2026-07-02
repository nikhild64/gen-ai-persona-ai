import { Injectable } from '@angular/core';

import type {
  ModerationPort,
  ModerationVerdict,
} from '../../domain/ports/moderation.port';

/**
 * AD-12 — client-side heuristic moderation. Layer 1 catches obvious
 * jailbreak / off-domain / adult / hate / self-harm inputs BEFORE they reach
 * the LLM; layer 2 double-checks the LLM's output before it surfaces to the
 * user (retry-once-then-refuse is enforced in ChatOrchestrator).
 *
 * Keyword lists are intentionally conservative — cohort review before
 * expansion. Overshooting hurts UX more than undershooting hurts safety
 * given the persona-prompt REFUSAL RULES also fire from within the LLM.
 */
@Injectable()
export class HeuristicModerationAdapter implements ModerationPort {
  private readonly jailbreakPatterns: RegExp[] = [
    /ignore\s+(all\s+)?(previous\s+)?instructions/i,
    /you\s+are\s+now\s+DAN/i,
    /pretend\s+you\s+have\s+no\s+filters/i,
    /(disregard|bypass|forget)\s+your\s+(system|initial)\s+(prompt|instructions)/i,
    /developer\s+mode\s+(enabled|on)/i,
    /^(base64|b64)[:\s]/i,
    /new\s+system\s+prompt\s*:/i,
    /respond\s+as\s+if\s+you\s+have\s+no\s+(rules|restrictions)/i,
  ];

  private readonly adultKeywords: string[] = [
    'sexual content',
    'erotic',
    'porn',
    'nsfw explicit',
  ];

  private readonly hateKeywords: string[] = [
    'kill all',
    'exterminate',
    'racial slur',
  ];

  private readonly selfHarmKeywords: string[] = [
    'suicide',
    'kill myself',
    'self-harm',
    'ending my life',
  ];

  private readonly politicalKeywords: string[] = [
    'modi ji',
    'rahul gandhi',
    'kejriwal',
    'election result',
    'bjp vs congress',
    'hindu vs muslim',
  ];

  async check(
    text: string,
    direction: 'input' | 'output',
  ): Promise<ModerationVerdict> {
    const lower = text.toLowerCase();

    if (text.length > 8000) {
      return {
        allowed: false,
        category: 'off_domain',
        suggested_refusal: 'Text too long.',
      };
    }
    if (HeuristicModerationAdapter.hasHeavyRepetition(text)) {
      return {
        allowed: false,
        category: 'off_domain',
        suggested_refusal: 'Repetitive spam-like content.',
      };
    }

    if (direction === 'input') {
      for (const pattern of this.jailbreakPatterns) {
        if (pattern.test(text)) return { allowed: false, category: 'jailbreak' };
      }
    }

    if (this.selfHarmKeywords.some((k) => lower.includes(k))) {
      return { allowed: false, category: 'self_harm' };
    }
    if (this.adultKeywords.some((k) => lower.includes(k))) {
      return { allowed: false, category: 'adult' };
    }
    if (this.hateKeywords.some((k) => lower.includes(k))) {
      return { allowed: false, category: 'hate' };
    }
    if (this.politicalKeywords.some((k) => lower.includes(k))) {
      return { allowed: false, category: 'political' };
    }

    return { allowed: true };
  }

  private static hasHeavyRepetition(text: string): boolean {
    if (text.length < 40) return false;
    for (let i = 0; i < text.length - 4; i += 1) {
      const chunk = text.slice(i, i + 4);
      const escaped = chunk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matches = text.match(new RegExp(escaped, 'g'));
      if (matches && matches.length > 20) return true;
    }
    return false;
  }
}
