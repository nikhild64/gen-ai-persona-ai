import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { CustomPersonaStore } from '../../domain/custom-persona/custom-persona.store';
import { isCustomPersonaId } from '../../domain/types/custom-persona';

export const customPersonaRouteGuard: CanActivateFn = (route) => {
  const raw = route.paramMap.get('customId');
  if (!raw) return inject(Router).parseUrl('/');
  const id = raw.startsWith('custom:') ? raw : `custom:${raw}`;
  if (!isCustomPersonaId(id)) return inject(Router).parseUrl('/');
  const store = inject(CustomPersonaStore);
  return store.get(id) ? true : inject(Router).parseUrl('/');
};
