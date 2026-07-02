import { inject } from '@angular/core';
import { Router, type Routes } from '@angular/router';

import { ChatComponent } from './chat.component';
import { FEATURE_ASK_BOTH_MODE } from '../../config/feature-flags';

/**
 * Chat surface routes — Solo modes + Ask-Both lazy-loaded per AD-21. When
 * FR-32 kill-switch `FEATURE_ASK_BOTH_MODE=false`, the ask-both route
 * silently redirects to landing per EXPERIENCE.md.State Patterns.
 */
export const CHAT_ROUTES: Routes = [
  { path: '', component: ChatComponent, data: { persona: 'hitesh' } },
  { path: 'hitesh', component: ChatComponent, data: { persona: 'hitesh' } },
  { path: 'piyush', component: ChatComponent, data: { persona: 'piyush' } },
  {
    path: 'ask-both',
    canActivate: [
      () =>
        FEATURE_ASK_BOTH_MODE ? true : inject(Router).parseUrl('/'),
    ],
    loadChildren: () =>
      import('../ask-both/ask-both.routes').then((m) => m.ASK_BOTH_ROUTES),
  },
];
