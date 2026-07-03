import type { Routes } from '@angular/router';

import { FEATURE_SPIKE_ROUTES } from '../config/feature-flags';

/**
 * Route table. E1-S1 will replace the default redirect with the landing page
 * component; for now `/` sends users straight into the Hitesh chat so E2-S4
 * is browsable without landing UI.
 */
const spikeRoutes: Routes = FEATURE_SPIKE_ROUTES
  ? [
      {
        path: 'spike/gemini-cors',
        loadComponent: () =>
          import('../features/spike/spike-gemini-cors.component').then(
            (m) => m.SpikeGeminiCorsComponent,
          ),
      },
    ]
  : [];

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadChildren: () =>
      import('../features/landing/landing.routes').then((m) => m.LANDING_ROUTES),
  },
  {
    path: 'chat',
    loadChildren: () =>
      import('../features/chat/chat.routes').then((m) => m.CHAT_ROUTES),
  },
  ...spikeRoutes,
];
