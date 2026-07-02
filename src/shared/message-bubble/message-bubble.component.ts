import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  computed,
  input,
} from '@angular/core';
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
  template: `
    <article
      class="bubble"
      [class.user]="message().role === 'user'"
      [class.assistant]="message().role === 'assistant'"
      [class.error]="message().status === 'error'"
      [class.cancelled]="message().status === 'cancelled'"
      [attr.data-persona]="message().persona || null"
    >
      @if (message().role === 'assistant') {
      <header class="bubble-header">
        <span class="persona-name">{{ personaLabel() }}</span>
        @if (message().status === 'streaming') {
        <span class="status-badge streaming">typing…</span>
        }
      </header>
      }
      <div class="bubble-body" [innerHTML]="renderedContent()"></div>
      @if (message().status === 'cancelled') {
      <footer class="bubble-status cancelled-badge">
        {{ cancelledLabel }}
      </footer>
      } @if (message().status === 'error') {
      <footer class="bubble-status error-badge">
        {{ errorLabel() }}
      </footer>
      }
    </article>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .bubble {
        max-width: 720px;
        padding: 0.85rem 1rem;
        border-radius: 12px;
        line-height: 1.5;
        color: #1c1917;
        font-size: 16px;
      }
      .bubble.assistant {
        background: var(--persona-bubble-bg, #f5f5f4);
        margin-right: auto;
      }
      .bubble.user {
        background: #e7e5e4;
        margin-left: auto;
        text-align: left;
      }
      .bubble.cancelled {
        opacity: 0.72;
      }
      .bubble.error {
        outline: 1px solid #dc2626;
      }
      .bubble-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.35rem;
        font-size: 13px;
        color: #57534e;
        gap: 0.5rem;
      }
      .persona-name {
        font-weight: 700;
      }
      .status-badge.streaming {
        font-style: italic;
        color: #78716c;
      }
      .bubble-body {
        word-break: break-word;
      }
      .bubble-body :first-child {
        margin-top: 0;
      }
      .bubble-body :last-child {
        margin-bottom: 0;
      }
      .bubble-body p {
        margin: 0.5rem 0;
      }
      .bubble-body pre {
        background: #0f172a;
        color: #e2e8f0;
        padding: 0.75rem 1rem;
        border-radius: 6px;
        overflow: auto;
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 14px;
      }
      .bubble-body code {
        background: rgba(0, 0, 0, 0.08);
        padding: 0.1em 0.35em;
        border-radius: 4px;
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 0.92em;
      }
      .bubble-body pre code {
        background: transparent;
        padding: 0;
      }
      .bubble-body ul,
      .bubble-body ol {
        padding-left: 1.4rem;
        margin: 0.4rem 0;
      }
      .bubble-status {
        margin-top: 0.5rem;
        font-size: 12px;
        color: #57534e;
      }
      .error-badge {
        color: #b91c1c;
      }
    `,
  ],
})
export class MessageBubbleComponent {
  readonly message = input.required<Message>();
  readonly cancelledLabel = PRODUCT_COPY.cancelledMessageBadge;

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
    return typeof parsed === 'string' ? parsed : raw;
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
