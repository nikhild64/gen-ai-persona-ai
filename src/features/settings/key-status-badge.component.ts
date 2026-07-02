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
  templateUrl: './key-status-badge.component.html',
  styleUrls: ['./key-status-badge.component.scss'],
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
