import { InjectionToken } from '@angular/core';

import type { StoragePort } from '../ports/storage.port';
import type { ModerationPort } from '../ports/moderation.port';
import type { AnalyticsPort } from '../ports/analytics.port';

/** AD-2: DI tokens for the port interfaces that ChatOrchestrator consumes. */
export const STORAGE_PORT = new InjectionToken<StoragePort>('StoragePort');
export const MODERATION_PORT = new InjectionToken<ModerationPort>(
  'ModerationPort',
);
export const ANALYTICS_PORT = new InjectionToken<AnalyticsPort>(
  'AnalyticsPort',
);
