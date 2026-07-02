import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';

import { KeyVaultService } from '../../domain/key-vault/key-vault.service';
import { PersonaRoutingService } from '../../domain/key-vault/persona-routing.service';
import { PRODUCT_COPY } from '../../config/product-copy';
import { keyStatusBadgeLabel } from '../../config/aria-labels';
import type { PersonaId } from '../../domain/types/persona';
import type { ProviderId } from '../../config/provider-registry';

/**
 * DESIGN.md.Components.key-status-badge — small chip reflecting current
 * KeyVaultService state; clickable to open Settings.
 *
 * Two supported modes:
 *   - `persona` set (solo chat): reflects the provider routed for that
 *     persona and whether its key is saved.
 *   - `askBoth` true (ask-both room): reflects the routing of BOTH
 *     personas. If they share a provider it reads like solo; if they
 *     diverge it says "Blend: Gemini + Groq" so the user isn't misled
 *     into thinking only one provider is in play.
 */
@Component({
  selector: 'app-key-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="badge"
      [class.saved]="state() === 'saved'"
      [class.none]="state() === 'none'"
      [attr.aria-label]="ariaLabel()"
      (click)="clicked.emit()"
    >
      <span class="dot" aria-hidden="true"></span>
      <span>{{ label() }}</span>
    </button>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        height: 36px;
        padding: 0 0.75rem;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 500;
        border: 1px solid rgba(0, 0, 0, 0.1);
        background: rgba(255, 255, 255, 0.7);
        color: #292524;
        cursor: pointer;
        font: inherit;
        transition:
          background 0.15s ease,
          border-color 0.15s ease;
      }
      .badge.saved:hover {
        background: white;
        border-color: var(--persona-accent, rgba(0, 0, 0, 0.2));
      }
      .badge.none {
        color: #b45309;
        border-color: rgba(254, 215, 170, 0.9);
        background: rgba(255, 247, 237, 0.85);
      }
      .badge.none:hover {
        background: #fff7ed;
        border-color: #fed7aa;
      }
      .badge:focus-visible {
        outline: 2px solid var(--persona-accent, #0ea5e9);
        outline-offset: 2px;
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #a1a1aa;
      }
      .badge.saved .dot {
        background: #16a34a;
      }
      .badge.none .dot {
        background: #f59e0b;
      }
      @media (max-width: 720px) {
        .badge {
          display: none;
        }
      }
    `,
  ],
})
export class KeyStatusBadgeComponent {
  private readonly keyVault = inject(KeyVaultService);
  private readonly personaRouting = inject(PersonaRoutingService);
  readonly clicked = output<void>();

  /** Solo mode. When set, the badge reflects the provider routed for this
   *  persona. Omit for ask-both / neutral surfaces. */
  readonly persona = input<PersonaId | null>(null);

  /** Ask-both mode. When true, the badge reflects the combined routing of
   *  both personas. Ignored when `persona` is set. */
  readonly askBoth = input<boolean>(false);

  /** Unique providers that actually power the requests visible on this
   *  surface. One entry for solo (or ask-both where both personas share a
   *  provider); two entries when ask-both blends providers. */
  readonly relevantProviders = computed<ProviderId[]>(() => {
    const p = this.persona();
    if (p) return [this.personaRouting.getProviderFor(p)];
    if (this.askBoth()) {
      const h = this.personaRouting.getProviderFor('hitesh');
      const py = this.personaRouting.getProviderFor('piyush');
      return h === py ? [h] : [h, py];
    }
    const fallback = this.keyVault.currentProvider();
    return fallback ? [fallback] : [];
  });

  readonly state = computed<'saved' | 'none'>(() => {
    const providers = this.relevantProviders();
    if (providers.length === 0) return 'none';
    // All required providers must have a saved key for the badge to read
    // "saved". A single missing key in blend mode should still nudge the
    // user toward Settings.
    return providers.every((p) => this.keyVault.getKeyForProvider(p) !== null)
      ? 'saved'
      : 'none';
  });

  readonly label = computed(() => {
    const providers = this.relevantProviders();
    if (providers.length === 0) return PRODUCT_COPY.keyStatusNoKeyLabel;
    if (providers.length === 1) {
      const only = providers[0];
      return this.keyVault.getKeyForProvider(only) !== null
        ? PRODUCT_COPY.keyStatusUsingLabel(only)
        : `${providerName(only)} key needed`;
    }
    // Blend mode — two distinct providers in play.
    const missing = providers.filter(
      (p) => this.keyVault.getKeyForProvider(p) === null,
    );
    if (missing.length === 0) {
      return `Blend`;
    }
    return `Blend needs ${missing.map(providerName).join(' + ')} key${
      missing.length > 1 ? 's' : ''
    }`;
  });

  readonly ariaLabel = computed(() =>
    keyStatusBadgeLabel(this.state(), this.relevantProviders()[0] ?? undefined),
  );
}

function providerName(id: ProviderId): string {
  return id === 'gemini' ? 'Gemini' : 'Groq';
}
