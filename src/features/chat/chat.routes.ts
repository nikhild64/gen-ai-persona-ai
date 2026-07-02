import type { Routes } from '@angular/router';

import { ChatComponent } from './chat.component';

/**
 * Chat surface routes — Solo modes + Ask-Both lazy-loaded per AD-21.
 */
export const CHAT_ROUTES: Routes = [
  { path: '', component: ChatComponent, data: { persona: 'hitesh' } },
  { path: 'hitesh', component: ChatComponent, data: { persona: 'hitesh' } },
  { path: 'piyush', component: ChatComponent, data: { persona: 'piyush' } },
  {
    path: 'ask-both',
    loadChildren: () =>
      import('../ask-both/ask-both.routes').then((m) => m.ASK_BOTH_ROUTES),
  },
];
