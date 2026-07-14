---
name: Bandyou Page Redesign Status
description: Which pages have been redesigned and what state they are in
type: project
---

## Priority pages — status as of 2026-04-28

### Landing (`/landing`) — DONE
Strong editorial design with serif/sans headline mix, role pills on desktop, bento category grid, stats bar, CTA section.

### Home (`/home`) — DONE (full redesign 2026-07-13)
Completely restructured. New layout: Hero with big greeting + search-bar link + 3 action pills (Publicar/Vender/Crear evento). Events strip in main column (was sidebar-only on desktop). Gear moved to main column as 2-col mobile / 4-col desktop grid. Musicians and bands as enhanced scroll strips. Premium banner at bottom. Sidebar condensed to teachers, rehearsal spaces, venues only.
All sections: show real Supabase data when loaded, hardcoded example content in @else (never blank pages). 4 hardcoded events (Rock en el Río, Flamenco Fusion, Jazz at Sunset, Metal Fest), 4 gear items with gradient placeholder backgrounds, 5 musician cards, 4 band cards.

### Feed (`/feed`) — DONE (redesigned 2026-04-28)
Replaced emoji-only empty state with icon-based warm design, replaced `btn-accent` where inconsistent, removed erroneous escaped-slash class binding, improved post cards with location icon, improved author avatar to use `bg-primary-500`, improved loading skeletons, added SVG spinner in load-more button.

### Dashboard (`/dashboard`) — DONE (redesigned 2026-04-28)
Replaced all emoji empty states with semantic SVG icons, replaced `btn-accent` with `btn-primary`, replaced `🔗 Compartir` button text with SVG link icon, improved copy-link state feedback with checkmark SVG, improved location display in profile hero with pin SVG, added proper loading skeleton, added `section-label` for sidebar headers, replaced emoji in sidebar post items with SVG icon.

### Search (`/search`) — DONE
Already had well-designed skeleton loading, card structure with terracotta top-accent stripe, proper empty states with SVG icons, genre pill filters, city dropdown, mobile tab strip. No major redesign needed.

### Musician Profile (`/musicians/:id`) — DONE (2026-04-28)
Fix applied: hero avatar changed from `bg-dark-700 text-primary-400` (low contrast) to `bg-primary-500 text-white` (WCAG AA compliant).

### Band Profile (`/bands/:id`) — DONE (2026-04-28)
Same avatar fix as musician profile applied.

### Rehearsal Profile (`/rehearsal/:id`) — DONE (2026-04-28)
Same avatar fix applied. Already had good price highlight, booking form, reviews.

### Teacher Profile (`/teachers/:id`) — DONE (2026-04-30 full pass)
Avatar fix applied. Spinner loading replaced with layout-accurate hero + content skeleton. Empty state now has icon container + CTA link. Review form stars upgraded to text-2xl with hover:scale-110; empty stars changed from `text-dark-600` (invisible) to `text-ink-muted opacity-40`. Review list empty stars fixed from `text-dark-600` to `text-dark-500 opacity-50`.

### Venue Profile (`/venues/:id`) — DONE (2026-04-30 full pass)
Avatar fix applied. Spinner loading replaced with layout-accurate hero + content skeleton. Empty state now has icon container + CTA link. Review form and review list star visibility fixed (same pattern as teacher/rehearsal profiles).

### Favorites (`/favorites`) — DONE (2026-04-28)
Fixed avatar contrast (was `bg-dark-750 text-ink-2`, now `bg-primary-500 text-white`).
Fixed tab pills to use `genre-pill-active`/`genre-pill-inactive` classes instead of custom bindings.

### Inbox (`/inbox`) — DONE (2026-04-28)
Fixed: `btn-accent` on empty state CTA replaced with `btn-primary`. Conversation avatars changed from `bg-dark-750 text-ink-2` to `bg-primary-500 text-white`.

### Chat (`/inbox/:id`) — DONE (2026-04-28)
Fixed: header avatar changed to `bg-primary-500 text-white`. Send button changed from `btn-accent` to `btn-primary`.

## Global review pass — 2026-04-30

### Auth pages (login, register, forgot-password) — IMPROVED
Added warm terracota blob backgrounds (`blur-3xl bg-primary-900/20`) to break the flat `bg-dark-900` feel.

### Navbar — FIXED
Replaced emoji icons (`📢`, `📅`) in mobile hamburger menu with `<app-icon>` components.

### Home (`/home`) — IMPROVED
Empty states for musicians/bands/rehearsals/teachers/venues sidebar sections now have CTA links instead of bare text.

### Dashboard (`/dashboard`) — IMPROVED
Profile completion bar now uses gradient left-accent, `+visibilidad` tag-accent badge, and properly joined missing fields with ` · ` separator instead of comma list.

### Musician Profile — IMPROVED
Replaced bare spinner loading with a full hero + content skeleton that matches the actual layout.

### Band Profile — IMPROVED
Same skeleton loading improvement as musician profile.

### Rehearsal Profile — IMPROVED
Same skeleton loading improvement. Star rating buttons now use `text-ink-muted opacity-40` for empty stars (was `text-dark-600` — nearly invisible). Review form stars increased to text-2xl and have hover:scale-110. Empty star display in review list also improved.

### Gear Detail — IMPROVED
- Replaced `✓ Marcar como vendido` emoji with `<app-icon name="check"/>`.
- Seller card: avatar changed to `bg-primary-900 text-primary-400` with rounded-xl, seller name now has arrow-right icon indicator.

### Chat (`/inbox/:id`) — IMPROVED
Empty state: replaced bare text with warm icon container (`bg-primary-900 border border-primary-500/25`) and two-line description mentioning the other person's name.

### Inbox (`/inbox`) — IMPROVED
Header: unread count now shown as a pill badge next to title. Added "Explorar" ghost link on desktop. Plural for "conversaciones" fixed.

## Mobile UI pass — 2026-07-13

### Home sidebar — FIXED
Converted sidebar sections (Próximos eventos, Tienda, Ensayo, Clases, Salas) from stacked vertical dump on mobile to horizontal-scroll strips. Each section wraps its list in `flex lg:flex-col gap-3 overflow-x-auto pb-2 no-scrollbar snap-x snap-mandatory lg:gap-2 lg:overflow-x-visible lg:pb-0 lg:snap-none`. Individual cards get `flex-shrink-0 min-w-[180px] lg:min-w-0 snap-start`. Tienda uses `w-[130px] lg:w-auto` with `flex lg:grid lg:grid-cols-2`. Section wrapper divs get `px-4 pt-4 pb-3 lg:px-0 lg:pt-0 lg:pb-0 border-b border-dark-600 lg:border-b-0`. The "+ Publicar" CTA links are `hidden lg:flex` (removed from mobile). Aside wrapper: `lg:py-6 lg:px-5 lg:gap-7` (no mobile padding/gap — each section self-manages it).

### Musician profile — FIXED
Desktop action buttons now `hidden sm:flex sm:flex-col` (hidden on mobile). Added fixed mobile CTA bar: `fixed bottom-16 left-0 right-0 z-30 bg-dark-800/98 backdrop-blur-md border-t border-dark-600 px-4 py-3 flex gap-3 sm:hidden`. Container padding-bottom set to 144px to clear the CTA bar + bottom nav. The duplicate send button in the right column sidebar is `hidden sm:block`. Same pattern should be applied to band-profile, rehearsal-profile, teacher-profile, venue-profile.

### Feed form — FIXED
Meta fields changed from `grid grid-cols-2 sm:grid-cols-3` to `grid grid-cols-1 sm:grid-cols-3` (single col on mobile). Type selector pills changed from `flex flex-wrap` to `flex overflow-x-auto pb-1 no-scrollbar snap-x` with `flex-shrink-0 snap-start` on each pill button.

### Inbox — IMPROVED
Conversation rows now have `min-h-[64px]` for comfortable touch targets.

### Onboarding — IMPROVED
Container padding changed to `px-5 py-8 sm:py-12` (less aggressive top padding on mobile). All heading sizes changed to `text-3xl sm:text-4xl`. Pill buttons for instruments and genres changed from `py-2` to `py-2.5 min-h-[44px]` for proper 44px touch targets.

## Mobile CTA bar pass — 2026-07-14

### Band Profile — FIXED
- `padding-bottom` changed from 64px → 144px
- Desktop actions changed from `flex flex-row sm:flex-col` → `hidden sm:flex sm:flex-col` (hidden on mobile)
- Mobile CTA bar added: `fixed bottom-16 left-0 right-0 z-30 bg-dark-800/98 backdrop-blur-md border-t border-dark-600 px-4 py-3 flex gap-3 sm:hidden`
- Sidebar send button now `hidden sm:block`

### Venue Profile — REDESIGNED + FIXED
- `padding-bottom` changed from 64px → 144px
- Hero redesigned from flat gradient → cover strip + overlapping avatar pattern (matching musician/band)
- `btn-accent` in actions changed to `btn-primary`
- Desktop actions now `hidden sm:flex sm:flex-col`
- Mobile CTA bar added with Contactar + Guardar + Compartir
- Sidebar send button now `hidden sm:block`

### Teacher Profile — REDESIGNED + FIXED
- `padding-bottom` changed from 64px → 144px
- Hero redesigned from flat gradient → cover strip + overlapping avatar pattern
- `btn-accent` in actions changed to `btn-primary`
- Desktop actions now `hidden sm:flex sm:flex-col`
- Mobile CTA bar added with Solicitar clase + Guardar + Compartir (includes bookingSuccess state)
- Sidebar send button now `hidden sm:block`

### Rehearsal Profile — REDESIGNED + FIXED
- `padding-bottom` changed from 64px → 144px
- Hero redesigned from flat gradient → cover strip + overlapping avatar pattern
- Desktop actions now `hidden sm:flex sm:flex-col`
- Mobile CTA bar added with Solicitar reserva + Guardar + Compartir
- Sidebar reservar button now `hidden sm:block`

### Register — FIXED
- Left panel feature grid: replaced `@for` with emoji icons (`🎸🎤🏛️📚`) with static items using inline SVGs
- GOTCHA: `app-icon` is NOT available in the register component (not imported in its .ts). Must use inline SVG in this component.

### Event Form — FIXED
- Success state: `bg-emerald-500/10 border-emerald-500/30 text-emerald-400` → `bg-signal-gBg border-signal-green/30 text-signal-green`
- Section headers: `border-dark-700/60` → `border-dark-600` (3 occurrences)
- `padding-bottom` changed from 64px → 80px

### Event Detail — FIXED
- `padding-bottom` changed from 64px → 80px

### Notifications — IMPROVED + FIXED
- `padding-bottom` changed from 64px → 80px
- Loading state: bare spinner replaced with layout-accurate skeleton (5 rows with icon + text lines)

### Favorites + Inbox — FIXED
- `padding-bottom` changed from 64px → 80px

## Redesign pass — 2026-07-14 (second round)

### Gear List (`/shop`) — REDESIGNED (Vinted-style)
- Added sticky compound header: title bar (`bg-dark-800/98 backdrop-blur-md`) + filter strip (`bg-dark-900/98`) both at `sticky top-16 z-20`
- Filter strip uses `flex overflow-x-auto no-scrollbar gap-2 py-2.5`: two rounded-full selects (city, category) + thin divider + condition pills with `[class.bg-primary-500]` toggle + "Limpiar" with X SVG
- Grid: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3` — Vinted-style cards with `aspect-[4/3]` image, gradient overlay, condition badge top-left, image count top-right, price pill bottom-left
- Cards: `hover:scale-105` image zoom, `active:scale-[0.98]` tap feedback, price in `text-sm font-black text-white bg-black/70 backdrop-blur-sm px-2.5 py-0.5 rounded-full`
- Sell button uses `btn-primary` (was `btn-accent`)
- Loading: 8-cell skeleton grid with `aspect-square bg-dark-700 animate-pulse`

### Gear Detail (`/shop/:id`) — FIXED
- `padding-bottom` changed 80px → 144px (cleared mobile CTA bar + bottom nav)
- Contact button in info column: `btn-accent` → `btn-primary`, added `hidden sm:inline-flex` (mobile CTA handles mobile)
- Login link in info column: added `hidden sm:block`
- Added mobile fixed CTA bar: `fixed bottom-16 left-0 right-0 z-30 bg-dark-800/98 backdrop-blur-md border-t border-dark-600 px-4 py-3 flex gap-3 sm:hidden`
  - Shows: contact button (non-owner + logged in), login link (not logged in), edit link (owner)
  - Only shown when `listing().status === 'active'`

### Sidebar — IMPROVED
- Added `section-label` "EXPLORAR" between Inicio divider and Músicos
- Added `section-label` "MI CUENTA" replacing the plain divider before Favoritos
- Pattern: divider first (`border-t border-dark-600 mt-2 mb-1`), then `<p class="section-label px-2 py-1.5">` for Explorar; for Mi cuenta: `<div class="border-t border-dark-600 mt-3 pt-2.5 mb-0.5"><p class="section-label px-2">Mi cuenta</p></div>`

### Home (`/home`) — BUG FIXED
- Two occurrences of `bg-green-500` on band "busca" availability dot → `bg-signal-green`

## Full redesign pass — 2026-07-14 (WhatsApp/Instagram/Facebook/Vinted inspiration)

### Inbox (`/inbox`) — REDESIGNED
- Loading state: bare spinner replaced with 5-row skeleton (avatar circle + two text lines with flex justify-between for timestamp)
- Header: now `sticky top-16 z-10` with `bg-dark-800/98 backdrop-blur-sm`, search icon only (no text label on desktop button)
- Avatar: bumped from w-11 h-11 (44px) to w-12 h-12 (48px)
- Row height: min-h-[72px] (was 64px)
- Unread badge: uses `min-w-[20px] h-5 px-1.5` pill (cleaner for 2-digit counts)
- Dividers: `divide-dark-600/60` (slightly more subtle than solid)
- Unread row name: `font-black text-ink` vs read: `font-semibold text-ink`
- Unread timestamp: `text-primary-500` (was same grey as read)
- Delete button: `text-transparent group-hover:text-ink-muted/60` (more subtle reveal)

### Chat (`/inbox/:id`) — REDESIGNED
- Loading state: skeleton bubbles instead of bare spinner (2 left + 2 right bubbles with animate-pulse)
- Header: `bg-dark-800/98 backdrop-blur-sm` with better touch targets
- Date separator: "Inicio de la conversación" now a proper pill with horizontal lines (`flex items-center gap-3 my-2` + `flex-1 h-px bg-dark-700` on each side)
- Own message bubbles: added `shadow-md` for depth
- Messages: `gap-2` kept, own bubbles `max-w-[78%] sm:max-w-sm`
- Send button: shows spinner `animate-spin` while sending instead of just disabled state
- Input: aria-label added, `aria-label="Enviar mensaje"` on button

### Feed (`/feed`) — REDESIGNED
- Post cards: added `relative` + `<div class="absolute inset-y-0 left-0 w-[3px] bg-primary-500/50 group-hover:bg-primary-500/80 transition-colors rounded-l-2xl">` left accent bar
- Inner content gets `pl-6` (was `p-4`) to account for accent bar
- Form textarea: character counter moved inside textarea as absolute overlay (bottom-right, avoids layout shift)
- Filter area: `space-y-2.5` wrapper, min-h-[36px] on select/input/clear button
- Type pills in form: `py-2 min-h-[36px]` (was py-1.5) for better touch targets
- "Limpiar" button: `min-h-[36px]` touch target
- Skeleton: uses `card-flat` instead of manual `bg-dark-800 border border-dark-600 rounded-2xl`

### Musician Profile (`/musicians/:id`) — REDESIGNED
- Cover: `h-36 sm:h-52` (was h-32 sm:h-44) — taller for more visual impact
- Avatar: `w-28 h-28 sm:w-32 sm:h-32` (was w-24 h-24 sm:w-28 sm:h-28) — bigger
- Avatar overlap: `-mt-14 sm:-mt-16` (was -mt-12 sm:-mt-14)
- Info column pushdown: `pt-16 sm:pt-18` (was pt-14 sm:pt-16)
- Cover gradient darkened: `'linear-gradient(135deg, ...' + '28 0%, #1a1208 50%, #0f0b07 100%)'`
- Ficha rows: `text-xs` on both label and value (was text-sm), `py-3` padding
- Added `hourly_rate` row in ficha card if field exists
- Social links: added `rel="noopener noreferrer"` to all external links
- Desktop action buttons: `w-full` added so they fill the sidebar column cleanly

### Dashboard (`/dashboard`) — IMPROVED
- Stats row buttons: each now has an SVG icon above the number (calendar/message/broadcast/music note)
- Icon color: `text-primary-500` when active tab, `text-ink-muted` when inactive
- Number: `text-xl` (was `text-2xl`) to accommodate icon without overflow on mobile
- Label: `text-[9px]` (was `text-[10px]`) for tighter fit
- Stats cells: `flex flex-col items-center gap-0.5` for proper vertical centering
- Messages stat: unread dot moved to `absolute -top-1 -right-1.5` (slight tweak)

### Login (`/auth/login`) — POLISHED
- Background: subtle dot-grid pattern overlay (`opacity-[0.02]`) in right panel
- Submit button: shows spinner icon while loading (was just text "Entrando...")
- Error message: now includes SVG error icon before the text
- Fields: added `id` attributes + `<label for="...">` for proper accessibility
- Submit button: `min-h-[50px]` for better touch target

### Navbar — IMPROVED
- Background: `bg-dark-900/98` (was `bg-dark-800/98`) — matches page background better
- Mobile menu: `bg-dark-900/98` with `backdrop-blur-md`, dividers between sections (`h-px bg-dark-600/60`)
- Mobile menu items: `py-2.5` height, `justify-start` alignment for ghost buttons
- Bottom nav: `bg-dark-900/98`, touch targets `min-w-[56px] min-h-[56px]` (was 44px)
- Bottom nav: shows user avatar image when `avatarUrl()` is set (instead of icon only)
- Unread badge: `min-w-[16px] h-4 px-0.5` pill for multi-digit counts
- Gap between icon and label: `gap-0.5` (was `gap-1`)

## Pages still with known technical debt

- Map: component file not found (may not exist yet)
- Gear form (new listing form): not audited
- Auth forgot-password / reset-password: not audited
- Legal pages: not design priority

## Known patterns established

- Empty states: use SVG icon in `rounded-2xl bg-dark-700 border border-dark-600` 48x48 container, not emojis
- Profile avatars in lists AND hero: use `bg-primary-500 text-white` for initials fallback — NEVER `bg-dark-750 text-ink-2` or `bg-dark-700 text-primary-400` (both fail WCAG AA)
- Section labels in sidebars: use `section-label` class
- Location display: include location pin SVG before city name
- Sidebar "ver todos" links: `text-[10px] font-semibold text-primary-400 hover:text-primary-500`
- Tab pills: use `genre-pill-active` / `genre-pill-inactive` from styles.css
- `btn-accent` is defined as an alias for `btn-primary` in styles.css — both are valid
- Do NOT use hardcoded `style="background:#a0442a"` — use `class="bg-primary-500"`
- NEVER use `bg-green-500` for availability/success indicators — use `bg-signal-green`
- For `hidden sm:inline-flex` pattern: use `hidden sm:inline-flex` (not `hidden sm:flex`) when toggling visibility of a `btn-primary` element, since `btn-primary` already sets `inline-flex`
