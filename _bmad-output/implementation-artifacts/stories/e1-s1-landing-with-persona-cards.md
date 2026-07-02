# Story E1-S1: Landing component with persona cards + parody disclaimer

Status: ready-for-dev

- **Epic:** 1 — Landing & Persona Selection
- **Critical-path position:** 15 of 37 (Day 4 morning)
- **Blocks:** none directly (but landing is grader's first surface)
- **Depends on:** E0-S3, E4-S2

## Story

As a **cohort grader (Rahul) on a Sunday evening**,
I want **to land on the URL and immediately see two equal-weight persona cards (Hitesh + Piyush) with a visible parody disclaimer**,
So that **I can pick a persona in one click and know I'm engaging with an AI simulation, not the real person**.

## Acceptance Criteria

**Given** the app is deployed on Vercel,
**When** the grader navigates to the root URL `/`,
**Then** the landing route (`src/features/landing/landing.component.ts`) loads lazily via Angular Router `loadChildren` per AD-21 and renders within LCP ≤ 2.0s on cable (measured via Vercel Speed Insights).

**Given** the landing page has rendered,
**When** the grader views it at a 1280×720 desktop viewport AND at 375×667 mobile viewport,
**Then** both persona cards render above the fold on both viewports per FR-1 (per DESIGN.md.Layout: 60px hero + 160px Hitesh card + 16px gap + 160px Piyush card + 40px disclaimer + safe-area fits within 667px mobile height).

**Given** both cards are visible,
**When** the grader inspects the cards,
**Then** neither is visually pre-selected or given differential prominence (equal size, equal position weight per FR-1); each card is a single click/tap target (per UX-DR1); persona name, photo (`/avatars/hitesh.jpg` or `/avatars/piyush.jpg`), tagline (from `PERSONA_REGISTRY[personaId].greeting`-derived one-liner OR from `product-copy.ts.landingHiteshTagline` and `landingPiyushTagline` verbatim from Addendum §D.1/§D.2), and known-for one-liner are all visible without hover.

**Given** the grader clicks a card,
**When** the click event fires on `<persona-card>`,
**Then** Angular Router navigates to `/chat/{persona}` (Epic 4 wires the child routes) and the chat surface loads.

**Given** the grader tabs to the card and presses Enter,
**When** the keydown event fires,
**Then** same navigation happens (per UX-DR19 keyboard-first).

**Given** the landing page has rendered,
**When** the grader looks below the fold or scrolls,
**Then** the parody disclaimer band is visible within the first viewport height on both desktop and mobile (per FR-2) — text from `product-copy.ts.landingDisclaimerBand` including (a) "AI simulation, not the real person"; (b) "Cohort-authorized educational demo built with permission of Hitesh Choudhary and Piyush Garg for the ChaiCode GenAI cohort"; (c) a takedown-contact link (`mailto:` scheme with pre-filled subject).

### Cross-cutting AC (per `cross-cutting-AC-checklist.md`)

- **AC-A20.1** — Tab traverses landing hero → Hitesh card → Piyush card → disclaimer link → footer takedown link.
- **AC-A20.2** — Persona card ARIA label from `aria-labels.ts` (e.g., `personaCardLabel: (persona) => \`Chat with ${personaDisplayName(persona)}\``); disclaimer link uses `disclaimerLinkLabel`.
- **AC-A20.3** — `:focus-visible` on persona cards renders 2px `focus-ring` outline with 2px offset.
- **AC-A20.4** — Persona card CTA button contrast (white on `--persona-accent`): Piyush 8.6:1 (AAA); Hitesh 3.13:1 (passes AA large-text ≥ 3:1 for 13px `label` at 500 weight per DESIGN.md.Do's).
- **AC-A20.6** — Persona card hover shadow transition respects `prefers-reduced-motion` (snaps to end state).
- **AC-A21.1** — Landing feature module lazy-loaded via `loadChildren`.
- **AC-A21.4** — LCP ≤ 2.0s on cable via Vercel Speed Insights.
- **AC-A22.1** — Landing hero title, subheader, disclaimer, tagline, "Start chatting" CTA all from `product-copy.ts`. No inline persona-voice strings in `src/features/landing/`.
- **AC-A22.4** — `<app-footer>` renders on landing route (verifies E1-S2 also lands on this route).

**verifies:** FR-1, FR-2, AD-1, AD-17 (persona card `[data-persona]` scope), AD-20 (cross-cutting), AD-21 (cross-cutting), AD-22 (cross-cutting)

**touches:** `src/features/landing/landing.component.ts`, `src/features/landing/landing.component.scss`, `src/features/landing/landing.component.html`, `src/features/landing/persona-card.component.ts`, `src/features/landing/landing.routes.ts` (with `loadChildren` from `app.routes.ts`), `src/config/product-copy.ts` (new keys: `landingHeroTitle`, `landingHeroSubheader`, `landingHiteshTagline`, `landingPiyushTagline`, `landingCtaLabel`, `landingDisclaimerBand`), `src/config/aria-labels.ts` (new keys: `personaCardLabel`), `public/avatars/hitesh.jpg`, `public/avatars/piyush.jpg`

**test target:** component test (axe-core on landing route; card renders both personas at both viewports via headless Playwright) + e2e test (click card → navigates to `/chat/{persona}`) + unit test (`assertContrast` on landing card CTA color combinations)

## Developer Context

Grader's first surface. Landing route replaces the temporary `redirectTo: 'chat/hitesh'` in `app.routes.ts` from E2-S4. Two equal persona cards + parody disclaimer + footer.

**Avatar assets:** if not yet in `public/avatars/`, add `hitesh.jpg` and `piyush.jpg` here per docs/attributions.md (E12-S1 will document the source URL). Both same crop (circular, same size). Cohort-authorized per docs/creator-permissions.md.

**PersonaCard is a standalone component** — takes `@Input persona: PersonaId`. Reads persona-scoped styling from `[attr.data-persona]="persona"` on the card element (per AD-17). Card renders name from `personaDisplayName`, tagline from `product-copy`, avatar from `--persona-avatar-url` CSS var.

## Technical Requirements

### `src/features/landing/landing.component.ts`

Standalone component. Renders hero band + 2-column card grid + disclaimer band. Footer is app-shell (E1-S2 lands `<app-footer>`).

```ts
@Component({
  standalone: true,
  imports: [PersonaCardComponent, RouterLink],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent {
  readonly personas: PersonaId[] = ['hitesh', 'piyush'];
  readonly heroTitle = copy.landingHeroTitle;
  readonly heroSubheader = copy.landingHeroSubheader;
  readonly disclaimerBand = copy.landingDisclaimerBand;
}
```

### `src/features/landing/persona-card.component.ts`

```ts
@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-persona-card',
  templateUrl: './persona-card.component.html',
  styleUrls: ['./persona-card.component.scss'],
})
export class PersonaCardComponent {
  @Input({ required: true }) persona!: PersonaId;

  displayName(): string { return personaDisplayName(this.persona); }
  tagline(): string {
    return this.persona === 'hitesh' ? copy.landingHiteshTagline : copy.landingPiyushTagline;
  }
  ariaLabel(): string { return aria.personaCardLabel(this.persona); }
  ctaLabel(): string { return copy.landingCtaLabel; } // "Start chatting →"
  routerLink(): string { return `/chat/${this.persona}`; }
}
```

Template (per DESIGN.md.Landing geometry):
```html
<a class="persona-card" [routerLink]="routerLink()" [attr.data-persona]="persona" [attr.aria-label]="ariaLabel()">
  <img class="avatar" [src]="'/avatars/' + persona + '.jpg'" alt="" width="96" height="96">
  <h2>{{displayName()}}</h2>
  <p class="body-lg tagline">{{tagline()}}</p>
  <button class="cta">{{ctaLabel()}}</button>
</a>
```

### `landing.routes.ts`

```ts
export const LANDING_ROUTES: Routes = [
  { path: '', component: LandingComponent },
];
```

### `app.routes.ts` (replace redirect from E2-S4)

```ts
export const routes: Routes = [
  { path: '', loadChildren: () => import('./features/landing/landing.routes').then(m => m.LANDING_ROUTES) },
  { path: 'chat', loadChildren: () => import('./features/chat/chat.routes').then(m => m.CHAT_ROUTES) },
];
```

### `product-copy.ts` additions

```ts
export const landingHeroTitle = 'Chat with Hitesh or Piyush.';
export const landingHeroSubheader = 'Two voices from the ChaiCode GenAI cohort. Pick one to start.';
export const landingHiteshTagline = 'Chai aur Code. Story sunata hun — phir tech samajhte hain saath mein. 😁';
export const landingPiyushTagline = 'I build devs, not just apps. देखो, actually कुछ नहीं है — chalo build करते हैं.';
export const landingCtaLabel = 'Start chatting →';
export const landingDisclaimerBand = 'AI simulation, not the real person. Cohort-authorized educational demo built with permission of Hitesh Choudhary and Piyush Garg for the ChaiCode GenAI cohort.';
```

*Note:* the two persona taglines above are AD-22 exceptions similar to `askBothGreeting` — they carry Hinglish flavor because they're direct verbatim from Addendum §D.1/§D.2 landing-card taglines. They live in `product-copy.ts` since they're rendered on landing (a chrome surface), NOT in a persona bubble.

Actually — Addendum §D.1/§D.2 has `Landing card tagline:` fields. These are persona-authored strings living in product chrome. Two options:
1. Keep in `product-copy.ts` with an AD-22 exception note (like `askBothGreeting`).
2. Reference via `PERSONA_REGISTRY[persona].landingTagline` (adds a field to PromptComposition or registry entry).

Option 2 is cleaner per AD-22. Extend `PERSONA_REGISTRY` entries with `landingTagline: string` in E0-S3 (already listed as touches). Card component reads via `PERSONA_REGISTRY[persona].landingTagline`. Update `PromptComposition` if needed OR add `landingTagline` at the top-level `PERSONA_REGISTRY[persona].landingTagline` sibling to `greeting` + `inputPlaceholder`.

**Preferred:** add `landingTagline: string` to the registry entry (not to PromptComposition — it's a chrome-adjacent value like `greeting`). Update E0-S3 if not done, or extend here.

### `aria-labels.ts` additions

`personaCardLabel` — already landed in E0-S3 per that story's file list. If not, add here.

## Architecture Compliance

- **AD-1:** static bundle serves landing.
- **AD-17:** persona card has `[attr.data-persona]="persona"` for local CTA button `--persona-accent` fill.
- **AD-20 cross-cutting:** Tab order, ARIA labels, focus-visible, contrast checks.
- **AD-21 cross-cutting:** `loadChildren` for landing route; LCP ≤ 2.0s measured.
- **AD-22 cross-cutting:** all chrome copy from `product-copy.ts` (or persona-registry for the tagline exception); `<app-footer>` from E1-S2 renders here too.

## Library / Framework Requirements

No new packages.

## File Structure Requirements

```
src/features/landing/
  landing.component.ts / .html / .scss
  persona-card.component.ts / .html / .scss
  landing.routes.ts
src/app/app.routes.ts               # UPDATE — replace redirect with landing lazy-load
src/config/product-copy.ts          # EXTEND
src/config/aria-labels.ts           # EXTEND if personaCardLabel not landed
public/avatars/hitesh.jpg           # add if not present
public/avatars/piyush.jpg           # add if not present
src/personas/persona.registry.ts    # EXTEND with landingTagline if opting for that approach
```

## Testing Requirements

- Component test (`landing.component.spec.ts`): renders 2 persona cards; disclaimer band present.
- Component test (`persona-card.component.spec.ts`): click navigates to `/chat/{persona}`; keyboard Enter navigates; axe-core zero violations; contrast passes per assertContrast (Hitesh + Piyush CTA).
- e2e (Playwright): load `/` on desktop 1280×720 → both cards above fold; load on mobile 375×667 → both cards above fold with headroom.
- Vercel Speed Insights on deployed URL — LCP ≤ 2.0s (measured post-deploy at E12-S3).

## Latest Tech Information

- Angular 21 `RouterLink` on `<a>` for accessible navigation (better than click handler + programmatic navigate — screen readers get the link semantics).
- Vercel Speed Insights auto-tracks LCP; custom marks land in E11-S3 for chat TTFT.

## Previous Story Intelligence

**E4-S2 (Persona theming):**
- `--persona-accent` + `--persona-avatar-url` CSS vars work via `[data-persona]` scope. Card uses these for CTA fill + avatar.

**E0-S3 (Config):**
- `product-copy.ts` accepts new keys. `personaCardLabel` in aria-labels.
- `PERSONA_REGISTRY` should have `landingTagline` per this story's preference (extend if missing).

**E2-S4 (Chat):**
- Chat routes exist at `/chat/hitesh` + `/chat/piyush` (E4-S1 finalized these).

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-17` (persona card `[data-persona]` scope, lines 252–263), `AD-21` (lazy-load + LCP, lines 288–298), `AD-22` (product-copy separation, lines 300–309).
- DESIGN.md Landing geometry (lines 284–290), Components.persona-card (lines 323–330).
- EXPERIENCE.md Key Flows Flow 1 (Rahul, lines 235–246), Voice and Tone table (lines 51–60).
- Sprint status: key `e1-s1-landing-with-persona-cards`, blocks `[]`.

## References

- [Source: ARCHITECTURE-SPINE.md#AD-1] Pure-FE topology + landing on static bundle.
- [Source: DESIGN.md#Components.persona-card] Full visual spec.
- [Source: cross-cutting-AC-checklist.md] AD-20/21/22 items applicable.
- [Source: addendum.md#D.1/D.2] Landing card taglines verbatim.

## Story Completion Status

- [ ] `src/features/landing/landing.component.ts` + `persona-card.component.ts` + `landing.routes.ts` created.
- [ ] `app.routes.ts` updated to lazy-load landing at `/`.
- [ ] Product-copy extended: `landingHeroTitle`, `landingHeroSubheader`, `landingHiteshTagline`, `landingPiyushTagline`, `landingCtaLabel`, `landingDisclaimerBand`.
- [ ] Persona-registry extended with `landingTagline` (or accept via product-copy).
- [ ] `personaCardLabel` in aria-labels.
- [ ] Avatar assets at `public/avatars/`.
- [ ] Cross-cutting AC: Tab order, focus-visible, contrast, reduced-motion, `<app-footer>` renders on route (verifies E1-S2 landed).
- [ ] Component + e2e tests + axe-core.
