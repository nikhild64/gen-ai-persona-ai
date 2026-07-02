# Story E1-S2: App-footer shared component

Status: ready-for-dev

- **Epic:** 1 — Landing & Persona Selection
- **Critical-path position:** 16 of 37 (Day 4 morning)
- **Blocks:** none
- **Depends on:** E0-S3

## Story

As a **cohort grader**,
I want **the parody disclaimer + takedown-contact affordance visible on every route (not just landing)**,
So that **wherever I am in the app, I can reach the takedown link if a creator asks me to test the flow, and the AI-simulation notice is always one glance away**.

## Acceptance Criteria

**Given** the `<app-footer>` component is authored in `src/shared/app-footer/`,
**When** the app-shell layout (`src/app/app.component.html`) includes `<app-footer>` above the router-outlet's bottom,
**Then** the footer renders on every route — landing, `/chat/hitesh`, `/chat/piyush`, `/chat/ask-both`, and any error/404 routes (per AD-22).

**Given** the footer is rendered,
**When** the developer inspects the DOM,
**Then** the footer is NOT lazy-loaded — it's part of the app-shell bundle so it appears on Landing's LCP without a second network round-trip per AD-21.

**Given** the footer is rendered on a chat route,
**When** the developer views on desktop (≥ 1280px),
**Then** the footer shows the compact single-line version (per DESIGN.md.Components.app-footer): `caption` disclaimer left + `caption` takedown link right, `full-width × 48px`, `surface-chrome` background, `hairline` 1px top border.

**Given** the footer is rendered on landing,
**When** the developer views on desktop,
**Then** the landing's disclaimer band (E1-S1) shows the expanded version; the footer at the bottom shows the compact version — they are separate elements with related-but-distinct content (per DESIGN.md.Layout).

**Given** the footer takedown link is present,
**When** the grader clicks it,
**Then** the OS default `mailto:` handler opens with the pre-filled subject `"Chai Code Personas — takedown request"` and the recipient email from `product-copy.ts.takedownEmail` (which itself references the address documented verbatim in `docs/creator-permissions.md` at Epic 12).

**Given** the footer is rendered,
**When** the developer inspects the copy source,
**Then** every string comes from `product-copy.ts` — no inline literals per AD-22 (verified by the ESLint `no-restricted-syntax` rule from E0-S4).

### Cross-cutting AC (per `cross-cutting-AC-checklist.md`)

- **AC-A20.1** — Footer takedown link is the last stop in Tab traversal on any route.
- **AC-A20.2** — Takedown link uses `disclaimerLinkLabel` from `aria-labels.ts`.
- **AC-A20.3** — `:focus-visible` on the takedown link renders the 2px focus-ring.
- **AC-A20.4** — Footer copy contrast: `ink-secondary` `#57534E` on `surface-chrome` `#FAFAF9` = 7.8:1 (AAA).
- **AC-A21.2** — Footer is in the app-shell bundle (not lazy-loaded) — verified by inspecting the built bundle's initial JS payload.
- **AC-A22.1** — All footer copy from `product-copy.ts.footerDisclaimer` and `product-copy.ts.takedownContact`.
- **AC-A22.4** — Footer renders on every route (verified by navigating to each route + observing footer presence).

**verifies:** FR-2 (persistent footer disclaimer per AD-22), NFR-Accessibility, AD-22, AD-20 (cross-cutting), AD-21 (cross-cutting — bundle inclusion, not lazy)

**touches:** `src/shared/app-footer/app-footer.component.ts`, `src/shared/app-footer/app-footer.component.scss`, `src/shared/app-footer/app-footer.component.html`, `src/app/app.component.html` (add `<app-footer>` to app-shell layout), `src/config/product-copy.ts` (new keys: `footerDisclaimer`, `takedownContact`, `takedownEmail`, `takedownSubject`), `src/config/aria-labels.ts` (uses existing `disclaimerLinkLabel`)

**test target:** component test (footer renders on landing + chat routes + Ask-Both route via navigation e2e; axe-core on each route confirms footer is accessible) + unit test (`product-copy.ts.takedownEmail` matches the address in `docs/creator-permissions.md` — snapshot or explicit assertion)

## Developer Context

Simple always-present footer. Lives in app-shell (`app.component.html`), NOT lazy-loaded. Provides takedown contact affordance on every route per AD-22.

**Placement:** `app.component.html` structure:
```html
<router-outlet></router-outlet>
<app-footer></app-footer>
```

Since the app-shell renders on every route boot, the footer arrives with the initial bundle. This is intentional per AD-21 (avoid a second network round-trip for the footer on landing).

## Technical Requirements

### `src/shared/app-footer/app-footer.component.ts`

```ts
@Component({
  standalone: true,
  selector: 'app-footer',
  templateUrl: './app-footer.component.html',
  styleUrls: ['./app-footer.component.scss'],
})
export class AppFooterComponent {
  readonly disclaimer = copy.footerDisclaimer;
  readonly takedownContact = copy.takedownContact;
  readonly takedownLink = `mailto:${copy.takedownEmail}?subject=${encodeURIComponent(copy.takedownSubject)}`;
  readonly ariaLabel = aria.disclaimerLinkLabel;
}
```

Template:
```html
<footer class="app-footer">
  <span class="caption ink-secondary">{{disclaimer}}</span>
  <a class="caption takedown-link" [href]="takedownLink" [attr.aria-label]="ariaLabel">
    {{takedownContact}}
  </a>
</footer>
```

SCSS per DESIGN.md.Components.app-footer:
```scss
.app-footer {
  width: 100%;
  height: 48px;
  background: var(--surface-chrome, #FAFAF9);
  border-top: 1px solid var(--hairline, #E7E5E4);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}
```

### `app.component.html` extension

```html
<router-outlet></router-outlet>
<app-footer></app-footer>
```

(If landing needs a "no-footer" mode ever, add an app-shell signal; for now, always visible.)

### `product-copy.ts` additions

```ts
export const footerDisclaimer = 'AI simulation, not the real person. Cohort-authorized educational demo. Built with permission of Hitesh Choudhary + Piyush Garg for the ChaiCode GenAI cohort.';
export const takedownContact = 'Contact for takedown';
export const takedownEmail = 'takedown@example.com'; // TODO: update at E12-S1 to real address per docs/creator-permissions.md
export const takedownSubject = 'Chai Code Personas — takedown request';
```

## Architecture Compliance

- **AD-21:** footer in app-shell bundle (not lazy) — verified by `ng build --stats-json` showing footer JS in main chunk.
- **AD-22:** every string from `product-copy.ts`; ESLint E0-S4 enforces.
- **AD-20 cross-cutting:** last Tab stop, focus-visible, ARIA label, contrast ≥ 4.5:1.

## Library / Framework Requirements

No new packages.

## File Structure Requirements

```
src/shared/app-footer/
  app-footer.component.ts / .html / .scss
src/app/app.component.html    # UPDATE — add <app-footer>
src/config/product-copy.ts    # EXTEND
```

## Testing Requirements

- `app-footer.component.spec.ts`: renders disclaimer + takedown link with `mailto:` href + subject.
- e2e: navigate to `/`, `/chat/hitesh`, `/chat/piyush` — footer present on all.
- axe-core on each route confirms zero violations from footer.
- Snapshot: `takedownEmail` in `product-copy.ts` matches the address in `docs/creator-permissions.md` (E12-S1 populates the doc; this story uses a placeholder that E12-S1 aligns).

## Latest Tech Information

- `mailto:` scheme with `?subject=` URL param is universally supported.
- Angular 21 standalone component + inline usage in app.component (no NgModule needed).

## Previous Story Intelligence

**E0-S3 (Config):**
- `disclaimerLinkLabel` in `aria-labels.ts`.
- `product-copy.ts` open to extension.

**E1-S1 (Landing):**
- Landing has its own expanded disclaimer band (separate from footer).

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-21` (bundle inclusion, lines 288–298), `AD-22` (product-copy separation, lines 300–309).
- DESIGN.md Components.app-footer (lines 405–409).
- EXPERIENCE.md Component Patterns.app-footer (line 92).
- Sprint status: key `e1-s2-app-footer-shared`, blocks `[]`.

## References

- [Source: ARCHITECTURE-SPINE.md#AD-22] Footer rendered on every route via app-shell.
- [Source: DESIGN.md#Components.app-footer] Visual spec.
- [Source: cross-cutting-AC-checklist.md] AC-A20/21/22 items.

## Story Completion Status

- [ ] `src/shared/app-footer/app-footer.component.ts` — 48px footer with disclaimer + takedown link.
- [ ] `app.component.html` includes `<app-footer>` in app-shell.
- [ ] `product-copy.ts` extended with 4 new keys.
- [ ] Footer NOT lazy-loaded (verified via bundle inspection).
- [ ] Cross-cutting AC + spec tests + axe-core + e2e.
