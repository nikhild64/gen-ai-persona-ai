import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import Lara from '@primeng/themes/lara';

import { routes } from './app.routes';
import {
  STORAGE_PORT,
  MODERATION_PORT,
  ANALYTICS_PORT,
} from '../domain/chat/di-tokens';
import { IdbKeyvalStorageAdapter } from '../infrastructure/storage/idb-keyval.adapter';
import { HeuristicModerationAdapter } from '../infrastructure/moderation/heuristic.adapter';
import { NoOpModerationAdapter } from '../infrastructure/moderation/no-op.adapter';
import { VercelAnalyticsAdapter } from '../infrastructure/analytics/vercel.adapter';
import { FEATURE_MODERATION } from '../config/feature-flags';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: Lara,
        options: {
          darkModeSelector: '.p-dark',
        },
      },
    }),
    // AD-2 port wiring. E8-S2 will replace HeuristicModerationAdapter with
    // the real regex denylist; E6-S1 will layer redaction into
    // VercelAnalyticsAdapter.
    { provide: STORAGE_PORT, useClass: IdbKeyvalStorageAdapter },
    {
      provide: MODERATION_PORT,
      useClass: FEATURE_MODERATION
        ? HeuristicModerationAdapter
        : NoOpModerationAdapter,
    },
    { provide: ANALYTICS_PORT, useClass: VercelAnalyticsAdapter },
  ],
};
