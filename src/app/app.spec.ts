import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterOutlet, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, beforeEach, it, expect } from 'vitest';

import { AriaAnnouncerComponent } from '../shared/aria-announcer/aria-announcer.component';
import { AppFooterComponent } from '../shared/app-footer/app-footer.component';
import { AppHeaderComponent } from '../shared/app-header/app-header.component';
import { ANALYTICS_PORT, STORAGE_PORT } from '../domain/chat/di-tokens';
import { InMemoryStorageAdapter } from '../domain/chat/testing/in-memory-storage.adapter';

/**
 * Inline mirror of `App` so this spec runs under both `ng test` and raw
 * `vitest run` (external templateUrl/styleUrl are not resolved outside the
 * Angular unit-test builder).
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AriaAnnouncerComponent, AppFooterComponent, AppHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-aria-announcer />
    <div class="app-shell">
      <app-header />
      <div class="app-main">
        <router-outlet />
      </div>
      <app-footer />
    </div>
  `,
})
class AppTestHarness {}

describe('App', () => {
  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AppTestHarness],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: STORAGE_PORT, useClass: InMemoryStorageAdapter },
        { provide: ANALYTICS_PORT, useValue: { emit: () => {} } },
      ],
    }).compileComponents();
  });

  it('creates the root component', () => {
    const fixture = TestBed.createComponent(AppTestHarness);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the aria-announcer live region', async () => {
    const fixture = TestBed.createComponent(AppTestHarness);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const live = compiled.querySelector('[aria-live]');
    expect(live).toBeTruthy();
  });
});
