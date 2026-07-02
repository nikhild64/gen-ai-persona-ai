import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { isPersonaId } from '../../domain/types/persona';

/** Redirect invalid /chat/:persona slugs to landing. */
export const personaRouteGuard: CanActivateFn = (route) => {
  const slug = route.paramMap.get('persona');
  if (slug && isPersonaId(slug)) {
    return true;
  }
  return inject(Router).parseUrl('/');
};
