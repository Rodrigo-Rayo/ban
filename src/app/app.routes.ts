import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/landing/landing.component').then(m => m.LandingComponent),
  },
  {
    path: 'home',
    canActivate: [authGuard],
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'auth',
    children: [
      { path: 'login', loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
      { path: 'register', loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent) },
      { path: 'forgot-password', loadComponent: () => import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent) },
      { path: 'reset-password', loadComponent: () => import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent) },
    ],
  },
  {
    path: 'search',
    loadComponent: () => import('./features/search/search.component').then(m => m.SearchComponent),
  },
  {
    path: 'musicians/:id',
    loadComponent: () => import('./features/musicians/musician-profile/musician-profile.component').then(m => m.MusicianProfileComponent),
  },
  {
    path: 'bands/:id',
    loadComponent: () => import('./features/bands/band-profile/band-profile.component').then(m => m.BandProfileComponent),
  },
  {
    path: 'venues/:id',
    loadComponent: () => import('./features/venues/venue-profile/venue-profile.component').then(m => m.VenueProfileComponent),
  },
  {
    path: 'teachers/:id',
    loadComponent: () => import('./features/teachers/teacher-profile/teacher-profile.component').then(m => m.TeacherProfileComponent),
  },
  {
    path: 'rehearsal/:id',
    loadComponent: () => import('./features/rehearsal-spaces/rehearsal-profile/rehearsal-profile.component').then(m => m.RehearsalProfileComponent),
  },
  {
    path: 'events/create',
    canActivate: [authGuard],
    loadComponent: () => import('./features/events/event-form/event-form.component').then(m => m.EventFormComponent),
  },
  {
    path: 'events/:id',
    loadComponent: () => import('./features/events/event-detail/event-detail.component').then(m => m.EventDetailComponent),
  },
  {
    path: 'inbox',
    canActivate: [authGuard],
    loadComponent: () => import('./features/inbox/inbox.component').then(m => m.InboxComponent),
  },
  {
    path: 'inbox/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./features/chat/chat.component').then(m => m.ChatComponent),
  },
  {
    path: 'onboarding',
    canActivate: [authGuard],
    loadComponent: () => import('./features/onboarding/onboarding.component').then(m => m.OnboardingComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'favorites',
    canActivate: [authGuard],
    loadComponent: () => import('./features/favorites/favorites.component').then(m => m.FavoritesComponent),
  },
  {
    path: 'notifications',
    canActivate: [authGuard],
    loadComponent: () => import('./features/notifications/notifications.component').then(m => m.NotificationsComponent),
  },
  {
    path: 'feed',
    loadComponent: () => import('./features/feed/feed.component').then(m => m.FeedComponent),
  },

  {
    path: 'shop',
    loadComponent: () => import('./features/shop/gear-list/gear-list.component').then(m => m.GearListComponent),
  },
  {
    path: 'shop/new',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shop/gear-form/gear-form.component').then(m => m.GearFormComponent),
  },
  {
    path: 'shop/:id/edit',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shop/gear-form/gear-form.component').then(m => m.GearFormComponent),
  },
  {
    path: 'shop/:id',
    loadComponent: () => import('./features/shop/gear-detail/gear-detail.component').then(m => m.GearDetailComponent),
  },
  {
    path: 'legal',
    children: [
      {
        path: 'privacidad',
        loadComponent: () => import('./features/legal/privacy/privacy.component').then(m => m.PrivacyComponent),
      },
      {
        path: 'terminos',
        loadComponent: () => import('./features/legal/terms/terms.component').then(m => m.TermsComponent),
      },
      {
        path: 'cookies',
        loadComponent: () => import('./features/legal/cookies/cookies.component').then(m => m.CookiesComponent),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found.component').then(m => m.NotFoundComponent),
  },
];
