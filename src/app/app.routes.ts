import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

/** Private, transactional and auth pages must never be indexed. */
const NOINDEX = { noindex: true };

/**
 * Section paths without an id (/musicians, /events…), shared or typed by hand,
 * open that tab of the directory instead of a 404.
 */
const SECTION_TABS = ['musicians', 'bands', 'venues', 'teachers', 'rehearsal', 'events'] as const;
const sectionRedirects: Routes = SECTION_TABS.map(tab => ({
  path: tab, pathMatch: 'full' as const,
  redirectTo: () => inject(Router).createUrlTree(['/search'], { queryParams: { tab } }),
}));

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/landing/landing.component').then(m => m.LandingComponent),
  },
  {
    path: 'home', data: NOINDEX,
    canActivate: [authGuard],
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'auth',
    children: [
      { path: 'login', data: NOINDEX, loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
      { path: 'register', data: NOINDEX, loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent) },
      { path: 'forgot-password', title: 'Recuperar contraseña · BandYou', data: NOINDEX, loadComponent: () => import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent) },
      { path: 'reset-password', title: 'Nueva contraseña · BandYou', data: NOINDEX, loadComponent: () => import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent) },
      { path: 'callback', title: 'Accediendo… · BandYou', data: NOINDEX, loadComponent: () => import('./features/auth/callback/callback.component').then(m => m.CallbackComponent) },
    ],
  },
  {
    path: 'search',
    loadComponent: () => import('./features/search/search.component').then(m => m.SearchComponent),
  },
  ...sectionRedirects,
  {
    path: 'musicians/:id',
    loadComponent: () => import('./features/musicians/musician-profile/musician-profile.component').then(m => m.MusicianProfileComponent),
  },
  {
    path: 'bands/:id',
    loadComponent: () => import('./features/bands/band-profile/band-profile.component').then(m => m.BandProfileComponent),
  },
  {
    path: 'venues/new', title: 'Tu sala · BandYou', data: NOINDEX,
    canActivate: [authGuard],
    loadComponent: () => import('./features/venues/venue-form/venue-form.component').then(m => m.VenueFormComponent),
  },
  {
    path: 'venues/:id',
    loadComponent: () => import('./features/venues/venue-profile/venue-profile.component').then(m => m.VenueProfileComponent),
  },
  {
    path: 'teachers/new', title: 'Tu perfil de profesor · BandYou', data: NOINDEX,
    canActivate: [authGuard],
    loadComponent: () => import('./features/teachers/teacher-form/teacher-form.component').then(m => m.TeacherFormComponent),
  },
  {
    path: 'teachers/:id',
    loadComponent: () => import('./features/teachers/teacher-profile/teacher-profile.component').then(m => m.TeacherProfileComponent),
  },
  {
    path: 'rehearsal/new', title: 'Tu local de ensayo · BandYou', data: NOINDEX,
    canActivate: [authGuard],
    loadComponent: () => import('./features/rehearsal-spaces/rehearsal-form/rehearsal-form.component').then(m => m.RehearsalFormComponent),
  },
  {
    path: 'rehearsal/:id',
    loadComponent: () => import('./features/rehearsal-spaces/rehearsal-profile/rehearsal-profile.component').then(m => m.RehearsalProfileComponent),
  },
  {
    path: 'events/create', title: 'Crear evento · BandYou', data: NOINDEX,
    canActivate: [authGuard],
    loadComponent: () => import('./features/events/event-form/event-form.component').then(m => m.EventFormComponent),
  },
  {
    path: 'quedada', title: 'La quedada · BandYou',
    loadComponent: () => import('./features/quedada/quedada-page.component').then(m => m.QuedadaPageComponent),
  },
  {
    path: 'events/:id',
    loadComponent: () => import('./features/events/event-detail/event-detail.component').then(m => m.EventDetailComponent),
  },
  {
    path: 'inbox', title: 'Mensajes · BandYou', data: NOINDEX,
    canActivate: [authGuard],
    loadComponent: () => import('./features/inbox/inbox.component').then(m => m.InboxComponent),
  },
  {
    path: 'inbox/:id', title: 'Conversación · BandYou', data: NOINDEX,
    canActivate: [authGuard],
    loadComponent: () => import('./features/chat/chat.component').then(m => m.ChatComponent),
  },
  {
    path: 'onboarding', title: 'Tu perfil · BandYou', data: NOINDEX,
    loadComponent: () => import('./features/onboarding/onboarding.component').then(m => m.OnboardingComponent),
  },
  {
    path: 'dashboard', data: NOINDEX,
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'favorites', title: 'Favoritos · BandYou', data: NOINDEX,
    canActivate: [authGuard],
    loadComponent: () => import('./features/favorites/favorites.component').then(m => m.FavoritesComponent),
  },
  {
    path: 'notifications', title: 'Notificaciones · BandYou', data: NOINDEX,
    canActivate: [authGuard],
    loadComponent: () => import('./features/notifications/notifications.component').then(m => m.NotificationsComponent),
  },
  {
    path: 'feed',
    loadComponent: () => import('./features/feed/feed.component').then(m => m.FeedComponent),
  },
  {
    path: 'posts/:id',
    loadComponent: () => import('./features/feed/post-detail/post-detail.component').then(m => m.PostDetailComponent),
  },

  {
    path: 'shop',
    loadComponent: () => import('./features/shop/gear-list/gear-list.component').then(m => m.GearListComponent),
  },
  {
    path: 'shop/new', title: 'Vender artículo · BandYou', data: NOINDEX,
    canActivate: [authGuard],
    loadComponent: () => import('./features/shop/gear-form/gear-form.component').then(m => m.GearFormComponent),
  },
  {
    path: 'shop/:id/edit', title: 'Editar anuncio · BandYou', data: NOINDEX,
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
      { path: '', pathMatch: 'full', redirectTo: 'aviso-legal' },
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
      {
        path: 'aviso-legal',
        loadComponent: () => import('./features/legal/aviso-legal/aviso-legal.component').then(m => m.AvisoLegalComponent),
      },
    ],
  },
  // Short aliases people type or older links may use.
  { path: 'privacidad',  redirectTo: 'legal/privacidad' },
  { path: 'terminos',    redirectTo: 'legal/terminos' },
  { path: 'cookies',     redirectTo: 'legal/cookies' },
  { path: 'aviso-legal', redirectTo: 'legal/aviso-legal' },
  {
    path: '**', data: NOINDEX,
    loadComponent: () => import('./features/not-found/not-found.component').then(m => m.NotFoundComponent),
  },
];
