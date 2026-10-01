import { ApplicationConfig, Injectable, provideZoneChangeDetection, isDevMode, LOCALE_ID, ErrorHandler } from '@angular/core';
import { provideRouter, withPreloading, PreloadingStrategy, Route } from '@angular/router';
import { Observable, of } from 'rxjs';
import { provideServiceWorker } from '@angular/service-worker';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';

import { routes } from './app.routes';
import { GlobalErrorHandler } from './core/handlers/global-error.handler';

registerLocaleData(localeEs);

/** Routes worth warming right after bootstrap; everything else is covered by the SW prefetch. */
const PRELOAD_PATHS: ReadonlySet<string> = new Set(['home', 'search', 'login']);

@Injectable({ providedIn: 'root' })
export class SelectivePreloadingStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    return route.path && PRELOAD_PATHS.has(route.path) ? load() : of(null);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withPreloading(SelectivePreloadingStrategy)),
    { provide: LOCALE_ID, useValue: 'es' },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
