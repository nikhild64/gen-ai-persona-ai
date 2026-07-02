import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { AskBothModeToggleComponent } from './ask-both-mode-toggle.component';
import { AskBothModeService } from './ask-both-mode.service';

function segments(fixture: ComponentFixture<AskBothModeToggleComponent>) {
  return Array.from(
    fixture.nativeElement.querySelectorAll('button.segment'),
  ) as HTMLButtonElement[];
}

describe('AskBothModeToggleComponent (post-sprint AC-1 + AC-11)', () => {
  let fixture: ComponentFixture<AskBothModeToggleComponent>;
  let svc: AskBothModeService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [AskBothModeToggleComponent],
    });
    fixture = TestBed.createComponent(AskBothModeToggleComponent);
    svc = TestBed.inject(AskBothModeService);
    fixture.detectChanges();
  });

  afterEach(() => sessionStorage.clear());

  it('AC-1: renders exactly three segments (Sequential | Parallel | Blended)', () => {
    const segs = segments(fixture);
    expect(segs).toHaveLength(3);
    expect(segs.map((s) => s.textContent?.trim())).toEqual([
      'Sequential',
      'Parallel',
      'Blended',
    ]);
  });

  it('AC-1: highlights the active variant via aria-selected + .active', () => {
    svc.set('blended');
    fixture.detectChanges();
    const segs = segments(fixture);
    const blendedSeg = segs[2];
    expect(blendedSeg?.getAttribute('aria-selected')).toBe('true');
    expect(blendedSeg?.classList.contains('active')).toBe(true);
    expect(segs[0]?.getAttribute('aria-selected')).toBe('false');
  });

  it('AC-1: clicking a different segment updates the active mode', () => {
    const segs = segments(fixture);
    // default is sequential (build-time flag)
    segs[2]?.click();
    fixture.detectChanges();
    expect(svc.get()).toBe('blended');
    expect(segments(fixture)[2]?.classList.contains('active')).toBe(true);
  });

  it('AC-1: does NOT retroactively transform anything — only future state changes', () => {
    svc.set('sequential');
    fixture.detectChanges();
    const before = svc.get();
    segments(fixture)[2]?.click();
    fixture.detectChanges();
    expect(svc.get()).toBe('blended');
    expect(before).toBe('sequential');
  });

  it('AC-11: exposes a tablist role with an aria-label naming the active variant', () => {
    const track = fixture.nativeElement.querySelector('.track') as HTMLElement;
    expect(track?.getAttribute('role')).toBe('tablist');
    expect(track?.getAttribute('aria-label')).toContain('Ask-Both variant');
  });

  it('AC-11: manages tabindex — 0 on active, -1 on others (WAI-ARIA tablist)', () => {
    svc.set('parallel');
    fixture.detectChanges();
    const segs = segments(fixture);
    expect(segs[0]?.getAttribute('tabindex')).toBe('-1');
    expect(segs[1]?.getAttribute('tabindex')).toBe('0');
    expect(segs[2]?.getAttribute('tabindex')).toBe('-1');
  });

  it('AC-11: keyboard nav — ArrowRight cycles forward', () => {
    svc.set('sequential');
    fixture.detectChanges();
    const active = segments(fixture)[0]!;
    active.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    fixture.detectChanges();
    expect(svc.get()).toBe('parallel');

    segments(fixture)[1]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    fixture.detectChanges();
    expect(svc.get()).toBe('blended');
  });

  it('AC-11: keyboard nav — ArrowLeft cycles backward with wrap-around', () => {
    svc.set('sequential');
    fixture.detectChanges();
    segments(fixture)[0]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
    );
    fixture.detectChanges();
    expect(svc.get()).toBe('blended');
  });

  it('AC-11: keyboard nav — Home + End jump to extremes', () => {
    svc.set('parallel');
    fixture.detectChanges();
    segments(fixture)[1]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true }),
    );
    fixture.detectChanges();
    expect(svc.get()).toBe('blended');

    segments(fixture)[2]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true }),
    );
    fixture.detectChanges();
    expect(svc.get()).toBe('sequential');
  });

  it('AC-9: every segment exposes the "1 LLM call vs 2" cost tooltip', () => {
    const segs = segments(fixture);
    segs.forEach((s) => {
      const title = s.getAttribute('title') ?? '';
      expect(title).toContain('1 LLM call');
    });
  });

  it('disabled state blocks click + keyboard', async () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    const before = svc.get();
    segments(fixture)[2]?.click();
    fixture.detectChanges();
    expect(svc.get()).toBe(before);

    segments(fixture)[0]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    fixture.detectChanges();
    expect(svc.get()).toBe(before);
  });
});
