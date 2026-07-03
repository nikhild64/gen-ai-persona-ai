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
  templateUrl: './code-block.component.html',
  styleUrls: ['./code-block.component.scss'],
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
