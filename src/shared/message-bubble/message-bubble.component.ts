import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  SecurityContext,
  computed,
  inject,
  input,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { marked } from 'marked';

import type { Message } from '../../domain/types/message';
import { PRODUCT_COPY } from '../../config/product-copy';
import { personaDisplayName } from '../../personas/persona.registry';

marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * DESIGN.md.Components.message-bubble — visual state driven by AD-10
 * `Message.status` field. Persona-scoped theming via CSS custom properties
 * inherited from a parent `[data-persona]` container.
 *
 * Markdown rendering via `marked` with GFM enabled. Fenced code blocks land
 * as `<pre><code>` inside the bubble HTML for now; a follow-up story can
 * transclude them into the dedicated `<app-code-block>` component.
 */
@Component({
  selector: 'app-message-bubble',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './message-bubble.component.html',
  styleUrls: ['./message-bubble.component.scss'],
})
export class MessageBubbleComponent {
  readonly message = input.required<Message>();
  readonly cancelledLabel = PRODUCT_COPY.cancelledMessageBadge;
  private readonly sanitizer = inject(DomSanitizer);

  /**
   * AD-17 bubble-level attribution — carries persona scope on the host so
   * Ask-Both mode (E9) can render mixed-persona bubbles inside a neutral
   * container. Solo-mode bubbles inherit the container's persona anyway.
   */
  @HostBinding('attr.data-persona')
  get personaAttr(): string | null {
    const m = this.message();
    return m.role === 'assistant' && m.persona ? m.persona : null;
  }

  readonly personaLabel = computed(() => {
    const m = this.message();
    // Post-sprint Blended Ask-Both: `attributionLabel` (when set) overrides
    // the persona-derived name so the bubble header reads e.g.
    // "Hitesh + Piyush" for the fused-voice variant. Falls through to the
    // solo/sequential persona display name when absent.
    if (m.attributionLabel && m.attributionLabel.length > 0) {
      return m.attributionLabel;
    }
    const p = m.persona;
    return p ? personaDisplayName(p) : 'Assistant';
  });

  readonly renderedContent = computed(() => {
    const raw = this.message().content ?? '';
    if (this.message().role === 'user') {
      return this.escape(raw);
    }
    // `marked.parse` is synchronous when the input is a string.
    const parsed = marked.parse(raw);
    const html = typeof parsed === 'string' ? parsed : raw;
    return this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
  });

  readonly errorLabel = computed(
    () => this.message().error?.message ?? 'Something went wrong.',
  );

  private escape(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\n/g, '<br>');
  }
}
