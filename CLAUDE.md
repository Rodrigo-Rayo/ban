# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # dev server at http://localhost:4200
npm run build      # production build → dist/bandyou/
npm test           # unit tests via Karma/Jasmine
ng generate component features/<name>/<name>  # scaffold a new feature component
```

Angular CLI schematics are configured with `skipTests: true` for all generators, so test files are not created automatically.

## Architecture

**Bandyou** is an Angular 18 standalone-component SPA for the Spanish music community — connecting musicians, bands, venues, teachers, and rehearsal spaces.

### Data layer — Supabase

`SupabaseService` (`src/app/core/services/supabase.service.ts`) is the single wrapper around the Supabase client. All other services inject it and call `this.supabase.client` for database access or `this.supabase.auth` for authentication. Credentials live in `src/environments/environment.ts`.

**Key tables:** `musicians`, `bands`, `venues`, `teachers`, `rehearsal_spaces`, `profiles`, `band_members`, `conversations`, `messages`, `notifications`, `events`, `gear` (shop), `favorites`.

Each profile type has its own table keyed by `user_id`. A user has exactly one profile row across all type tables (enforced by `onConflict: 'user_id'` upserts in onboarding).

Real-time features (chat, notifications, inbox) use Supabase Realtime channels via `subscribeToMessages` / `subscribe` on the relevant service.

### Auth flow

`AuthService` (`src/app/core/services/auth.service.ts`) wraps session state in Angular signals (`_session`, `user`, `isLoggedIn`). The `authGuard` (`src/app/core/guards/auth.guard.ts`) protects routes that require login. After registration the user is sent through `/onboarding` to create their profile.

### Onboarding

`OnboardingComponent` handles both initial profile creation and editing. It detects whether a profile already exists by querying all five type tables and sets `isEditing`. Role selection is stored in `localStorage` as `bandyou_role` before the user navigates to onboarding.

### Routing

All routes use lazy-loaded standalone components (`loadComponent`). Protected routes use `[authGuard]`. The router is configured in `src/app/app.routes.ts`.

### Messaging

`MessagesService` manages `conversations` and `messages` tables. Conversations are keyed by `(user1_id, user2_id)` where `user1_id < user2_id` (lexicographic). Sending a message also triggers a notification insert via `NotificationsService.create`.

### Core services

| Service | Responsibility |
|---|---|
| `SupabaseService` | Supabase client singleton, auth helpers |
| `AuthService` | Session signal, login/logout/navigation |
| `MessagesService` | Conversations, messages, real-time inbox |
| `NotificationsService` | Notifications table + unread count signal + Realtime channel |
| `FavoritesService` | Favorites across all entity types |
| `ToastService` | Global toast notifications |
| `SeoService` | Page title / meta tags |

### Styling

Tailwind CSS with a custom warm-tone design system. Key conventions:

- **Theme palette:** `primary-*` (terracotta), `dark-*` (creams/warm whites — note: despite the name these are light), `night` (true dark blacks), `ink-*` (editorial blacks/grays), `signal-*` (status colors).
- **Component classes** are defined in `src/styles.css` under `@layer components`: `btn-primary`, `btn-secondary`, `btn-ghost`, `btn-night`, `card`, `card-flat`, `input-field`, `tag`, `avatar`, `nav-item`, etc.
- Always use these utility classes instead of raw Tailwind classes for UI consistency.
- The layout shell is `NavbarComponent` (top) + `SidebarComponent` (left, `lg:w-56`) + `<div class="lg:pl-56">` wrapping `<router-outlet>`.

### Shared components

`src/app/shared/components/` contains: `NavbarComponent`, `SidebarComponent`, `IconComponent` (SVG icon wrapper), `ToastComponent`, `InstallBannerComponent` (PWA install prompt).

### State management

No NgRx or external state library. State is managed with Angular signals at the service level and passed down via inputs or injected services.
