import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  signal,
  inject,
} from '@angular/core';

/**
 * DESIGN.md.Components.code-block — reads `--persona-code-block-emphasis`
 * from its host scope and applies default (Hitesh) vs foregrounded (Piyush)
 * treatment. Copy button always visible on the foregrounded variant per
 * UX-DR3; on default it appears on hover.
 */
@Component({
  selector: 'app-code-block',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="code-block-wrapper" [class.foregrounded]="foregrounded()">
      <button
        type="button"
        class="copy-btn"
        [attr.aria-label]="copyAriaLabel()"
        (click)="copy()"
      >
        {{ copyState() === 'copied' ? 'Copied' : 'Copy' }}
      </button>
      @if (language()) {
      <span class="language-tag">{{ language() }}</span>
      }
      <pre><code>{{ code() }}</code></pre>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .code-block-wrapper {
        position: relative;
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 6px;
        overflow: auto;
        max-height: 400px;
        margin: 0.5rem 0;
      }
      .code-block-wrapper.foregrounded {
        max-height: 560px;
        border-left: 3px solid var(--persona-accent, #0ea5e9);
      }
      .code-block-wrapper pre {
        margin: 0;
        padding: 0.9rem 1rem;
        font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo,
          monospace;
        font-size: 14px;
        line-height: 22px;
        font-weight: 400;
      }
      .code-block-wrapper.foregrounded pre {
        font-size: 15px;
        line-height: 24px;
        font-weight: 500;
      }
      .copy-btn {
        position: absolute;
        top: 0.4rem;
        right: 0.5rem;
        background: rgba(15, 23, 42, 0.85);
        color: #f1f5f9;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        padding: 0.2rem 0.5rem;
        font-size: 12px;
        opacity: 0;
        transition: opacity 0.15s ease;
        cursor: pointer;
      }
      .code-block-wrapper:hover .copy-btn,
      .code-block-wrapper.foregrounded .copy-btn,
      .copy-btn:focus-visible {
        opacity: 1;
      }
      .language-tag {
        position: absolute;
        top: 0.4rem;
        left: 0.6rem;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #94a3b8;
      }
    `,
  ],
})
export class CodeBlockComponent {
  readonly code = input<string>('');
  readonly language = input<string | undefined>(undefined);

  readonly copyState = signal<'idle' | 'copied'>('idle');

  private readonly host = inject(ElementRef<HTMLElement>);

  readonly foregrounded = computed(() => {
    const value = getComputedStyle(this.host.nativeElement)
      .getPropertyValue('--persona-code-block-emphasis')
      .trim();
    return value === 'foregrounded';
  });

  readonly copyAriaLabel = computed(() =>
    this.copyState() === 'copied' ? 'Copied to clipboard' : 'Copy code',
  );

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code());
      this.copyState.set('copied');
      setTimeout(() => this.copyState.set('idle'), 1500);
    } catch {
      /* clipboard permission denied — leave label idle */
    }
  }
}
