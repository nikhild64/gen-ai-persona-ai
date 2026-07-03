import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  inject,
  signal,
  computed,
} from '@angular/core';

/**
 * AD-20 aria-live announcer. A single `polite` live region into which any
 * feature can write a full completed message. Per-chunk emission is
 * DELIBERATELY not supported — screen readers cannot cope with a stream of
 * partial reads.
 *
 * Usage: inject `AriaAnnouncerService` and call `.announce('Hitesh says: …')`.
 * Only one `<app-aria-announcer>` should be mounted (in `app.component.html`
 * or the chat shell).
 */
@Injectable({ providedIn: 'root' })
export class AriaAnnouncerService {
  private readonly text = signal('');
  readonly currentAnnouncement = computed(() => this.text());

  announce(fullText: string): void {
    // Clear first so identical messages are still re-read by assistive tech.
    this.text.set('');
    setTimeout(() => this.text.set(fullText), 30);
  }
}

@Component({
  selector: 'app-aria-announcer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './aria-announcer.component.html',
})
export class AriaAnnouncerComponent {
  readonly announcer = inject(AriaAnnouncerService);
}
