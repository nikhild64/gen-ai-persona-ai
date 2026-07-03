import { inject } from '@angular/core';
import { Router, type Routes } from '@angular/router';

import { ChatComponent } from './chat.component';
import { personaRouteGuard } from './persona-route.guard';
import { customPersonaRouteGuard } from './custom-persona-route.guard';
import { FEATURE_ASK_BOTH_MODE } from '../../config/feature-flags';

export const CHAT_ROUTES: Routes = [
  { path: '', redirectTo: 'musk', pathMatch: 'full' },
  {
    path: 'ask-both',
    canActivate: [
      () =>
        FEATURE_ASK_BOTH_MODE ? true : inject(Router).parseUrl('/'),
    ],
    loadChildren: () =>
      import('../ask-both/ask-both.routes').then((m) => m.ASK_BOTH_ROUTES),
  },
  {
    path: 'custom/:customId',
    component: ChatComponent,
    canActivate: [customPersonaRouteGuard],
  },
  {
    path: ':persona',
    component: ChatComponent,
    canActivate: [personaRouteGuard],
  },
];
