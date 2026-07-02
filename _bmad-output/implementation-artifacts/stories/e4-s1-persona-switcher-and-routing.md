# Story E4-S1: PersonaSwitcher component + `/chat/{persona}` routing + keyboard nav

Status: ready-for-dev

- **Epic:** 4 — Persona Switcher
- **Critical-path position:** 12 of 37 (Day 3 afternoon)
- **Blocks:** E4-S2, E4-S3, E1-S1, E9-S1
- **Depends on:** E0-S3, E2-S4, E3-S1

## Story

As a **cohort grader**,
I want **a visible persona switcher in the chat header that I can click, tap, or use ArrowLeft/ArrowRight on when focused to flip between Hitesh and Piyush**,
So that **switching feels immediate and I can compare the two voices on the same question in seconds**.

## Acceptance Criteria

**Given** the chat surface exists from Epic 2,
**When** the developer authors `src/features/persona-switcher/persona-switcher.component.ts`,
**Then** it renders per DESIGN.md.Components.persona-switcher — a `rounded-full` segmented toggle track (`36px` height, `4px` internal padding, `surface-container` background, `hairline-strong` border), two segments (one per persona) with `44px` min-width touch target + `label` weight text + 16px circular avatar left. Active segment has `--persona-accent` background fill + white `label` text; inactive is transparent with `ink-secondary` text; hover on inactive is `hairline` fill.

**Given** the switcher is placed in the chat header (Epic 2 chat.component.html header slot),
**When** the user clicks the inactive segment,
**Then** Angular Router navigates to `/chat/{other-persona}` and the router-outlet swaps the chat surface; the previous persona's thread is preserved in IndexedDB (from Epic 3).

**Given** the switcher has focus,
**When** the user presses ArrowLeft or ArrowRight,
**Then** the switcher cycles selection per UX-DR19 (mimicking segmented-toggle keyboard convention); `role="tablist"` on the container + `role="tab"` on each segment + `aria-selected` on the active segment per AD-20.

**Given** the routing lands on `/chat/hitesh`,
**When** the chat component reads `activePersona()` (from the route data),
**Then** the ChatOrchestrator loads `chat:hitesh:v1` from `StoragePort` and renders that thread; typing a message and sending routes to the Hitesh provider (Gemini per PROVIDER_DEFAULT_ROUTING, or Groq if Spike-0 fallback (a) is active).

**Given** the user switches from Hitesh to Piyush,
**When** they send a message on Piyush's thread,
**Then** the message is stored under `chat:piyush:v1` — Piyush's thread NEVER merges with Hitesh's. Switching back to Hitesh restores Hitesh's thread intact per FR-9.

**Given** the `/chat/hitesh` and `/chat/piyush` routes are defined in `chat.routes.ts`,
**When** the developer inspects `app.routes.ts`,
**Then** each route (including `/chat/ask-both` for Epic 9) is lazy-loaded via `loadChildren` per AD-21 — verified by `ng build --stats-json` showing distinct chunk files per persona/route.

### Cross-cutting AC (per `cross-cutting-AC-checklist.md`)

- **AC-A20.1** — Tab reaches persona-switcher after chat header controls (per `EXPERIENCE.md.Interaction Primitives` order).
- **AC-A20.2** — `personaSwitcherLabel: (persona) => \`Switch persona — currently ${personaDisplayName(persona)}\`` from `aria-labels.ts`.
- **AC-A20.3** — Segments have `:focus-visible` ring (2px `focus-ring` + 2px offset).
- **AC-A20.4** — Active segment contrast: Piyush white on blue-600 = 8.6:1 (AAA); Hitesh white on amber-600 = 3.13:1 (passes AA for 13px+ 500-weight labels per WCAG large-text definition; verified by `assertContrast` unit test with a `wcag-large-text` mode assertion).
- **AC-A21.1** — Persona-switcher and each chat/{persona} route lazy-loaded via `loadChildren`.
- **AC-A22.1** — Segment display labels + ARIA labels from `product-copy.ts` and `aria-labels.ts`.

**verifies:** FR-8, FR-9 (thread preservation across switch), AD-7 (persona identity isolation — no cross-thread bleed), AD-20 (cross-cutting), AD-21 (cross-cutting — lazy-loading), AD-22 (cross-cutting)

**touches:** `src/features/persona-switcher/persona-switcher.component.ts`, `src/features/persona-switcher/persona-switcher.component.scss`, `src/features/persona-switcher/persona-switcher.component.html`, `src/app/app.routes.ts` (add `/chat/hitesh` + `/chat/piyush` child routes via `loadChildren` on `chat.routes.ts`), `src/features/chat/chat.routes.ts` (child routes for hitesh + piyush), `src/features/chat/chat.component.ts` (read activePersona from route data), `src/config/aria-labels.ts` (uses existing `personaSwitcherLabel`), `src/config/product-copy.ts` (segment display labels if not derived from `PERSONA_REGISTRY[personaId].displayName`)

**test target:** component test (switcher renders active/inactive segments correctly; ArrowLeft/ArrowRight cycle selection; `role="tablist"` + `role="tab"` + `aria-selected` set correctly) + e2e test (click switcher → route changes → thread preserved after switch-and-back) + axe-core on chat route with switcher

## Developer Context

Signature interaction of the whole product. Two personas, one segmented toggle. E2-S4 landed a placeholder slot in the chat header; this story fills it.

**Route data pattern:** `chat.routes.ts` defines two child routes (`hitesh`, `piyush`) each with `data: { persona: 'hitesh' | 'piyush' }`. `ChatComponent` reads `route.snapshot.data['persona']` to derive `activePersona()` — a signal-based approach:

```ts
export class ChatComponent {
  private route = inject(ActivatedRoute);
  readonly activePersona = signal<PersonaId>(this.route.snapshot.data['persona']);
}
```

**Thread preservation:** the orchestrator's `getOrCreateThread(persona)` from E2-S3 reads `chat:${persona}:v1`. Switching route → activePersona changes → orchestrator reads a different key → different thread renders. IndexedDB persists both threads independently.

**Persona-switcher DISABLED during stream** — this story lands the component; E4-S3 lands the disable-during-stream behavior. Both AC apply here at the component-shape level.

## Technical Requirements

### `src/features/persona-switcher/persona-switcher.component.ts`

```ts
import { Component, Input, Output, EventEmitter, HostListener, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { PersonaId } from '@domain/types/message';
import { PERSONA_REGISTRY } from '@personas/persona.registry';
import * as aria from '@config/aria-labels';

@Component({
  standalone: true,
  selector: 'app-persona-switcher',
  templateUrl: './persona-switcher.component.html',
  styleUrls: ['./persona-switcher.component.scss'],
})
export class PersonaSwitcherComponent {
  @Input({ required: true }) activePersona!: PersonaId;
  @Input() disabled = false;
  @Output() switched = new EventEmitter<PersonaId>();

  private router = inject(Router);
  personas: PersonaId[] = ['hitesh', 'piyush'];

  displayName(p: PersonaId): string {
    return p === 'hitesh' ? 'Hitesh' : 'Piyush';
  }
  ariaLabel(): string {
    return aria.personaSwitcherLabel(this.activePersona);
  }

  onSelect(p: PersonaId): void {
    if (this.disabled || p === this.activePersona) return;
    this.switched.emit(p);
    this.router.navigate([`/chat/${p}`]);
  }

  @HostListener('keydown', ['$event'])
  onKey(ev: KeyboardEvent): void {
    if (this.disabled) return;
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
      const next = this.activePersona === 'hitesh' ? 'piyush' : 'hitesh';
      this.onSelect(next);
      ev.preventDefault();
    }
  }
}
```

Template with tablist ARIA:
```html
<div role="tablist" [attr.aria-label]="ariaLabel()">
  <button
    *ngFor="let p of personas"
    role="tab"
    [attr.aria-selected]="p === activePersona"
    [class.active]="p === activePersona"
    [class.disabled]="disabled"
    [attr.data-persona]="p"
    (click)="onSelect(p)"
    tabindex="{{ p === activePersona ? 0 : -1 }}"
  >
    <img [src]="'/avatars/' + p + '.jpg'" alt="" width="16" height="16">
    <span>{{displayName(p)}}</span>
  </button>
</div>
```

SCSS per DESIGN.md.Components.persona-switcher spec — segmented toggle, `rounded-full` track, `--persona-accent` active fill, focus-visible ring.

### `chat.routes.ts` (extend from E2-S4)

```ts
export const CHAT_ROUTES: Routes = [
  { path: 'hitesh', component: ChatComponent, data: { persona: 'hitesh' as PersonaId } },
  { path: 'piyush', component: ChatComponent, data: { persona: 'piyush' as PersonaId } },
  // Ask-Both lands in E9-S1
];
```

### `app.routes.ts` (extend)

```ts
export const routes: Routes = [
  { path: '', redirectTo: 'chat/hitesh', pathMatch: 'full' }, // E1-S1 replaces with landing
  { path: 'chat', loadChildren: () => import('./features/chat/chat.routes').then(m => m.CHAT_ROUTES) },
];
```

### `chat.component.ts` extension

Read persona from route data + wire the switcher:

```ts
readonly activePersona = signal<PersonaId>(this.route.snapshot.data['persona']);
// ...include <app-persona-switcher> in the header, bind [activePersona]="activePersona()" [disabled]="orchestrator.inFlightStream$()"
```

## Architecture Compliance

- **AD-7:** persona identity isolation — thread reads `chat:${persona}:v1` per switch; no cross-thread bleed.
- **AD-14:** switcher disabled during in-flight stream (E4-S3 lands the full disable UX; this story wires the `disabled` input).
- **AD-20 cross-cutting:** `role="tablist"` / `role="tab"` / `aria-selected`, ArrowLeft/Right cycling, focus-visible ring, ARIA labels from `aria-labels.ts`.
- **AD-21 cross-cutting:** each `/chat/{persona}` route lazy-loaded via `loadChildren`.
- **AD-22 cross-cutting:** all display labels from `product-copy.ts` or derived from `PERSONA_REGISTRY[persona].displayName`.

## Library / Framework Requirements

No new packages. Uses Angular Router's `data` field for persona binding.

## File Structure Requirements

```
src/features/persona-switcher/
  persona-switcher.component.ts / .html / .scss
src/features/chat/
  chat.routes.ts                # EXTEND with hitesh + piyush child routes
  chat.component.ts             # EXTEND to read persona from route.data
src/app/app.routes.ts           # EXTEND with lazy-loaded /chat
```

## Testing Requirements

- `persona-switcher.component.spec.ts`: renders 2 segments; active segment has `aria-selected="true"`; ArrowLeft with focus on active cycles to inactive; click on inactive calls `router.navigate`; `disabled` input suppresses click + arrow navigation.
- `chat.component.spec.ts` (extend): `activePersona()` reflects route data on both `/chat/hitesh` and `/chat/piyush`.
- e2e: click switcher → URL changes → orchestrator reads different thread; type in Piyush, switch to Hitesh, switch back → Piyush thread intact.
- axe-core on `/chat/hitesh` with the switcher — zero violations.
- Bundle-check: `ng build --stats-json` shows `chat.js` as a separate chunk (or per-persona if config forces separation).

## Latest Tech Information

- Angular 21 Router `data` field pattern for route-based static configuration.
- `role="tablist"` / `role="tab"` with keyboard-arrow cycling is the WAI-ARIA authoring practice for segmented toggles.
- `signal()` for `activePersona` — reactive route-data-driven state.

## Previous Story Intelligence

**E2-S4 (ChatComponent):**
- Header has a placeholder slot for `<app-persona-switcher>` — this story fills it.
- `activePersona()` was hardcoded as `'hitesh'`; this story sources from route data.

**E3-S1 (IdbKeyvalStorageAdapter):**
- Thread persistence works; switching between personas restores their independent threads.

**E0-S3 (Config):**
- `personaSwitcherLabel` in `aria-labels.ts` already lands.
- `PERSONA_REGISTRY[persona].providerId` for provider routing.

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-7` (persona identity isolation, lines 116–120), `AD-14` (in-flight disable + AbortController, lines 210–219), `AD-20` (aria labels + keyboard, lines 277–286), `AD-21` (lazy-load routes, lines 288–298).
- DESIGN.md `Components.persona-switcher` (lines 355–363).
- EXPERIENCE.md `Component Patterns.persona-switcher` (line 86), `Interaction Primitives` (lines 119–130).
- Sprint status: key `e4-s1-persona-switcher-and-routing`, blocks `[e4-s2, e4-s3, e1-s1, e9-s1]`.

## References

- [Source: ARCHITECTURE-SPINE.md#AD-7] Persona identity isolation.
- [Source: DESIGN.md#Components.persona-switcher] Full visual spec.
- [Source: EXPERIENCE.md#Component Patterns.persona-switcher] Keyboard-arrow cycling + in-flight-disable + AD-7 storage isolation.
- [Source: cross-cutting-AC-checklist.md] AD-20/21/22 items for switcher.

## Story Completion Status

- [ ] `src/features/persona-switcher/persona-switcher.component.ts` — segmented toggle with 2 personas; ArrowLeft/Right cycle; router.navigate on select.
- [ ] `role="tablist"` + `role="tab"` + `aria-selected` per AD-20; ARIA label from `personaSwitcherLabel`.
- [ ] `chat.routes.ts` — `/chat/hitesh` + `/chat/piyush` child routes with `data: { persona }`.
- [ ] `app.routes.ts` — `/chat` lazy-loaded via `loadChildren`.
- [ ] `chat.component.ts` — reads `activePersona` from route data; renders `<app-persona-switcher>` in header slot.
- [ ] Persona theme scope `[attr.data-persona]="activePersona()"` on chat container (foundational for E4-S2).
- [ ] Cross-cutting AC + spec tests + e2e + axe-core.
- [ ] `ng build --stats-json` shows chat lazy-loaded as separate chunk.
