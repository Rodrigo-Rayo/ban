import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';
import { injectAnalytics } from './app/core/utils/analytics';

if (environment.production) injectAnalytics();

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
