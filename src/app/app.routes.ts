import type { Routes } from '@angular/router';

import { FEATURE_SPIKE_ROUTES } from '../config/feature-flags';

/**
 * Main-app routes are populated in Epic 1+ (landing, chat, ask-both, settings).
 * The `/spike/gemini-cors` route is dev-only, gated by FEATURE_SPIKE_ROUTES,
 * and never linked from primary UI (user must type the URL to reach it).
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

export const routes: Routes = [...spikeRoutes];
