import type { Routes } from '@angular/router';

import { ChatComponent } from './chat.component';

/**
 * Chat surface routes — Solo mode. E4-S1 extends with `/chat/piyush` and
 * persona-switcher-driven navigation.
 */
export const CHAT_ROUTES: Routes = [
  { path: '', component: ChatComponent, data: { persona: 'hitesh' } },
  { path: 'hitesh', component: ChatComponent, data: { persona: 'hitesh' } },
  { path: 'piyush', component: ChatComponent, data: { persona: 'piyush' } },
];
