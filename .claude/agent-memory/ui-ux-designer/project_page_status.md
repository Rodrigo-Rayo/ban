---
name: Bandyou Page Redesign Status
description: Which pages have been redesigned and what state they are in
type: project
---

## Priority pages — status as of 2026-04-28

### Landing (`/landing`) — DONE
Strong editorial design with serif/sans headline mix, role pills on desktop, bento category grid, stats bar, CTA section.

### Home (`/home`) — DONE (redesign pass 2026-07-22)
Completely restructured. New layout: Hero with big greeting + search-bar link + 3 action pills (Publicar/Vender/Crear evento). Events strip in main column (was sidebar-only on desktop). Gear moved to main column as 2-col mobile / 4-col desktop grid. Musicians and bands as enhanced scroll strips. Premium banner at bottom. Sidebar condensed to teachers, rehearsal spaces, venues only.
All sections: show real Supabase data when loaded, hardcoded example content in @else (never blank pages). 4 hardcoded events (Rock en el Río, Flamenco Fusion, Jazz at Sunset, Metal Fest), 4 gear items with gradient placeholder backgrounds, 5 musician cards, 4 band cards.

### Feed (`/feed`) — DONE (redesigned 2026-04-28)
Replaced emoji-only empty state with icon-based warm design, replaced `btn-accent` where inconsistent, removed erroneous escaped-slash class binding, improved post cards with location icon, improved author avatar to use `bg-primary-500`, improved loading skeletons, added SVG spinner in load-more button.

### Dashboard (`/dashboard`) — DONE (redesigned 2026-04-28)
Replaced all emoji empty states with semantic SVG icons, replaced `btn-accent` with `btn-primary`, replaced `🔗 Compartir` button text with SVG link icon, improved copy-link state feedback with checkmark SVG, improved location display in profile hero with pin SVG, added proper loading skeleton, added `section-label` for sidebar headers, replaced emoji in sidebar post items with SVG icon.

### Search (`/search`) — REDESIGNED (2026-07-14 full card pass)
**Card layout**: All 6 entity types (musicians, bands, venues, events, teachers, rehearsal) now have distinct visual identities instead of the old identical stripe+card template.
**Musicians & Bands**: LinkedIn-inspired social profile cards — 56px tall gradient banner (avatarColor→#5a2617), circular avatar (56px, `border-[3px] border-dark-800`) overlapping banner via `-mt-7`, centered name/instrument/city/tags below, ghost-to-filled "Ver perfil" CTA button (`border border-primary-500/30 rounded-full group-hover:bg-primary-500`).
**Bands extra**: "Busca miembros" `tag-green` badge in banner top-right.
**Venues**: Stat-forward card — square avatar + name/city left, capacity number large (`text-2xl font-black`) top-right. Genre tags below.
**Events**: Kept date-box design. Replaced `[ngClass]` with: `[class.event-card-featured]` on wrapper, `[class.date-box-featured]`/`[class.date-box-default]` on date box (CSS classes added to styles.css), `[class.text-primary-400]`/`[class.text-ink-muted]` for text colors — all valid Angular 18 bindings.
**Teachers**: Vinted-inspired price-first — circular avatar (48px) + name/instrument/city, price badge (`bg-primary-900 border border-primary-500/20 rounded-xl`) top-right with large `€` number.
**Rehearsal**: Space stats card — square avatar + name/city, hourly rate as `text-2xl font-black` top-right, specs row (capacity + rooms count with icons below).
**Loading skeleton**: Updated to match profile card shape (banner + circle overlap). Reduced from 8 to 6 items, grid `lg:grid-cols-3` max (no xl:grid-cols-4).
**CSS added to styles.css**: `.date-box-featured`, `.date-box-default`, `.event-card-featured`.

### Musician Profile (`/musicians/:id`) — DONE (2026-04-28)
Fix applied: hero avatar changed from `bg-dark-700 text-primary-400` (low contrast) to `bg-primary-500 text-white` (WCAG AA compliant).

### Band Profile (`/bands/:id`) — DONE (vacancies UX pass 2026-07-22)
Avatar fix + cover gradient fix + modal apply form + vacancy status dots + empty state.

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

## A11y + consistency pass — 2026-07-19 (second-round audit)

### Auth (forgot-password, reset-password) — ALREADY GOOD
- forgot-password: has success state, labels with for+id, autocomplete="email". No changes needed.
- reset-password: `btn-accent` replaced with `btn-primary` on both the error-state link and the submit button.

### Venue Form — FIXED
- Back button: `aria-label="Volver"` added.
- All inputs/selects/textareas: `id` attributes added + `for` on every label.
- Autocomplete: `autocomplete="organization"` on name, `autocomplete="tel"` on phone, `autocomplete="street-address"` on address, `autocomplete="url"` on link fields.
- Genre pill buttons: `[attr.aria-pressed]` binding added; wrapped in `role="group"`.
- Submit: `btn-accent` → `btn-primary`, `min-h-[50px]` added.

### Teacher Form — FIXED
- Same label/id/autocomplete pattern applied (name→"name", city select, modality, rate, exp, description, experience, links).
- Instrument pills: `[attr.aria-pressed]` + `role="group"`.
- Level pills: `[attr.aria-pressed]` + `role="group"`.
- Submit: `btn-accent` → `btn-primary`, `min-h-[50px]` added.
- Back button: `aria-label="Volver"` added.

### Rehearsal Form — FIXED
- Same label/id pattern applied.
- Autocomplete: `organization` on name, `tel` on phone, `street-address` on address.
- Submit: `btn-accent` → `btn-primary`, `min-h-[50px]` added.
- Back button: `aria-label="Volver"` added.

### Gear Form — FIXED
- All raw Tailwind inputs/selects/textarea replaced with `input-field` class.
- All labels now have `for` + matching `id` on inputs.
- Image remove buttons: `aria-label="Eliminar foto N"` added; bumped from w-5 to w-6 h-6.
- Back button: `aria-label="Volver a la tienda"` + `min-h-[44px]` added.
- Submit: `btn-accent` → `btn-primary`, `min-h-[50px]` added.

### Gear Detail — FIXED
- Encoding corruption fixed: `â‚¬` → `€`, `â€¦` → `…`, `sesiÃ³n` → `sesión` (multiple occurrences).
- `text-ink-3` non-existent class → `text-ink-muted` on description paragraph.
- Image carousel prev/next buttons: `aria-label="Imagen anterior"` / `aria-label="Imagen siguiente"`, bumped to w-9 h-9.
- Dot pagination buttons: `role="tab"`, `[attr.aria-selected]`, `[attr.aria-label]` added; dots bumped to w-2 h-2.
- Thumbnail strip buttons: `[attr.aria-label]`, `[attr.aria-pressed]` added; img `alt` added.
- Mobile CTA bar buttons: `min-h-[44px]` added to all three variants.

### Gear List — FIXED
- Condition pill buttons: `[attr.aria-pressed]` added.

### Event Detail — FIXED
- RSVP button: `[attr.aria-pressed]="isGoing()"`, `[attr.aria-label]` (dynamic), `min-h-[44px]` added.
- Login link: `flex items-center` + `min-h-[44px]` for touch target.

### Search — FIXED
- Tab strip container: `role="tablist"`, `aria-label="Categorías de búsqueda"` added.
- Each tab button: `role="tab"`, `[attr.aria-selected]`, `[id]` added.
- Genre pill group: `role="group"`, `aria-label="Filtrar por género"` + `[attr.aria-pressed]` on each pill.

### Install Banner — FIXED
- Dismiss X button: `aria-label="Cerrar banner de instalación"` added.

### Notification Banner — FIXED
- `md:bottom-4` changed to `lg:bottom-4` — prevents banner overlapping bottom nav on tablet (768–1023px range still uses bottom nav).

## Visual refinement pass — 2026-07-20

### Home (`/home`) — REFINED
- Right sidebar section icons (Clases, Salas) now have `border border-primary-500/20` matching Ensayo icon treatment
- Musician/band/gear home grids: `lg:grid-cols-6` → `lg:grid-cols-4` (cards were too small at desktop)
- Mobile card widths: `w-24` → `w-28` for musician/band horizontal strip cards
- Location indicator: plain text → bordered pill `bg-dark-800 border border-dark-600 px-3 py-1.5 rounded-full` with map-pin SVG and bold city name

### Dashboard (`/dashboard`) — REFINED
- Stats row: `grid-cols-4` → `grid-cols-2 sm:grid-cols-4` (critical mobile fix — 4-col at mobile was cramped)
- Profile hero: changed from 1.5px accent strip to proper 80px gradient cover area with avatar overlapping it (`-mt-8`, `ring-4 ring-dark-800`, `pt-9` on info block)

### Musician Profile — REFINED
- Cover gradient darkened: end color `#f4efe6` → `#130d08` so cover reads as dark cinema, not light wash

### Band Profile — REFINED
- Cover gradient darkened: end color `#fef0e8` → `#130d08`; opacity `30` → `55`
- Vacancies empty state: bare text → two-line warm message ("Sin vacantes abiertas" + explanation)
- Genre: now uses `tag` class; city gets map-pin SVG icon; looking_for row gets `tag-green` badge

### Landing (`/landing`) — REFINED
- Hero: role pills strip added below CTAs (`Guitarristas`, `Baterías`, `Bandas`, `Salas`, etc.) as `tag` pills — grounds the page in music community context
- "Cómo funciona" section header: `section-label` class → `page-section-eyebrow` pattern (`text-[10px] font-semibold uppercase tracking-wider text-primary-400`); added explanatory paragraph
- Steps: upgraded from bare text list → editorial card grid — each step in `bg-dark-800 border border-dark-600 rounded-2xl p-5` with large backdrop step number `(text-[72px] display-serif text-dark-600/60)` + small numbered pill `(w-7 h-7 bg-primary-900 border border-primary-500/30)`
- Directory section: `section-label` → `page-section-eyebrow` pattern

### Onboarding (`/onboarding`) — REFINED
- All step progress indicators: `font-mono uppercase tracking-widest` → `font-semibold uppercase tracking-wider`
- All form field labels: `text-[10px] font-mono uppercase tracking-widest mb-2` → `text-xs font-semibold mb-1.5` (warmer, more readable)
- Section labels ("Formación", "Redes & portfolio"): same font-mono → font-semibold treatment
- Genre counter: `font-mono tracking-widest` → `font-medium` (reads more naturally)
- All h1s: `font-bold` → `font-black` (stronger hierarchy, more confident tone)

### Inbox (`/inbox`) — FIXED
- Empty state icon: `text-dark-500` → `text-ink-muted` (was near-invisible)
- Empty state container: `bg-dark-700` → `bg-dark-800 border border-dark-600`
- Empty state text: `font-semibold text-ink` → `font-bold text-ink text-base`; description gets `leading-relaxed`

### Event Form (`/events/create`) — REFINED
- All form labels: `font-mono uppercase tracking-widest` → `font-semibold uppercase tracking-wider` (consistent warming)
- Page header eyebrow: `font-mono` → `font-semibold text-primary-400`
- Page h1: `font-semibold` → `font-black`

### Feed (`/feed`) — REFINED
- Sticky header: added `Comunidad` eyebrow label in `text-primary-400` above h1
- h1 gets `leading-none`

### Favorites (`/favorites`) — REFINED
- Header: replaced `section-label` "Colección personal" → eyebrow `p.text-primary-400 "Mi colección"` + `h1.font-black`

### Search (`/search`) — REFINED
- Title: `font-bold` → `font-black tracking-tight`

## Patterns established — typography

- `font-mono uppercase tracking-widest` is banned for form labels and UI metadata. Use `font-semibold uppercase tracking-wider` or `font-semibold` instead.
- Page section eyebrows: `text-[10px] font-semibold uppercase tracking-wider text-primary-400` (NOT `section-label` which is gray)
- Profile cover gradients should always end in near-black (`#130d08` or `#0f0b07`) not light cream
- Dashboard/profile stats grids: ALWAYS include `sm:grid-cols-N` breakpoint on mobile — never `grid-cols-4` alone

## Global audit pass — 2026-07-20 (systematic bug sweep)

### Navbar — FIXED
- `text-ink-3` (non-existent) → `text-ink-muted` on all icon buttons (favorites, notifications, inbox desktop; notifications, inbox, hamburger mobile)
- Mobile touch targets: notifications, inbox, hamburger button now have `min-w-[44px] min-h-[44px] flex items-center justify-center`
- Toast avatar: `bg-dark-750 text-ink-2` → `bg-primary-500 text-white` (matches profile avatar pattern)

### Band Profile — FIXED
- `text-ink-3` (non-existent) → `text-ink-muted` on vacancy description, application message, band description, "not found" text (5 occurrences)
- Desktop action buttons: added `w-full` to sendMessage, toggleFav, shareLink buttons (now match musician-profile)
- Not-found empty state: added music icon container + 2-line message + improved CTA routerLink

### Musician Profile — FIXED
- Not-found empty state: added music icon container + 2-line message + specific CTA routerLink

### Favorites — FIXED
- `text-ink-3` → `text-ink-muted` on instrument/genre metadata text
- All-empty and tab-empty states: added `border border-dark-600` to icon containers, `text-dark-500` → `text-ink-muted` on SVG icons, `font-semibold` → `font-bold text-sm` on heading
- Load error state: added warning icon container + 2-line message structure (retry CTA uses `routerLink="/home"` — no reload method on FavoritesComponent)

### Feed — FIXED
- Filter type pills: changed from `flex flex-wrap` to `flex overflow-x-auto pb-1 no-scrollbar snap-x`, added `flex-shrink-0 snap-start whitespace-nowrap` to each pill

### Home — FIXED
- Error state SVG: `text-dark-500` → `text-ink-muted`

### Gear Form — FIXED
- h1: `font-bold` → `font-black` (consistent with established typography pattern)
- Error state: bare `<p>` → `<p>` with inline SVG error icon

## Second-round profile pass — 2026-07-21

### Venue Profile — IMPROVED
- Cover gradient end color fixed: `#fef0e8` → `#141410` (was cream/light, jarring on dark theme); opacity bumped `30` → `50` for stronger tint
- Overlay alpha reduced: `from-dark-800/30` → `from-dark-800/20` (gradient now handles the dark falloff)
- Hero chips: added `venue()!.venue_type` and `venue()!.rental_rate` chips (conditional, shown only if data exists)
- Genres section: converted from plain text `<p>` to `flex flex-wrap` tag pills using `genres?.split(',')` — each genre as `.tag`
- Ficha sidebar: added `venue_type` and `rental_rate` rows (conditional)
- Empty stars in review list: `text-dark-500 opacity-50` → `text-dark-600` (more visible)

### Teacher Profile — IMPROVED
- Cover gradient end color fixed: same `#fef0e8` → `#141410` fix
- Hero chips: added `teacher()!.level` chip with `capitalize` modifier (conditional)
- Modality chip: added `capitalize` modifier for consistent casing
- Booking form: redesigned with structured header (calendar icon + "Solicitar clase" title + teacher name), `animate-slide-in` entrance, `bg-primary-900/20` header tint, context hint "Se enviará como mensaje privado"
- `btn-accent` in review submit and booking submit → `btn-primary` (consistent)
- Sidebar price card: `p-5 text-center text-4xl` → `p-4 flex items-end justify-between text-3xl` — adds modality tag alongside price, removes pure duplication with hero
- Ficha sidebar: added `level` and `styles` rows (both conditional)
- Empty stars in review list: same `text-dark-500 opacity-50` → `text-dark-600` fix

## Polish pass — 2026-07-22 (Feed + Search + Notifications)

### Feed (`/feed`) — IMPROVED
- Filter row 1 (city/instrument): changed from `flex-wrap` to `overflow-x-auto no-scrollbar pb-1` so both controls stay on one scrollable row on mobile instead of wrapping to two rows
- Empty state: split into two branches — when active filters exist, shows "Sin resultados / No hay anuncios que coincidan con tus filtros" with a "Limpiar filtros" btn-secondary; when truly empty (no filters), keeps the original "Sin anuncios aún / Sé el primero en publicar" with publish CTA
- Mobile FAB: added `fixed bottom-24 right-4 z-50 lg:hidden w-14 h-14 rounded-full bg-primary-500` plus button for "Nuevo anuncio" (+ SVG icon, no text). Hidden on `lg+` since the header button handles desktop. Only shown when `currentUser() && !formOnly() && !showForm()`.

### Search (`/search`) — IMPROVED
- Filter bar restructured: split from one cramped flex row into two distinct rows
  - Row 1: Prominent search input — `w-full bg-dark-700 border-dark-600 rounded-xl pl-10 pr-9 py-2.5 text-sm` with larger search icon (SVG inline 16px) and inline clear button (`onSearchQueryChange('')`) that appears when `searchQuery()` has a value
  - Row 2: Compact city select + instrument input (when relevant tab) + **active filter chips** — removable per-filter pills (`bg-primary-900 text-primary-400 border border-primary-500/30 rounded-full px-2.5 py-1 flex-shrink-0`) with inline X SVG for each active filter (city, instrument, genre). Clear-all X button appears only when `hasActiveFilters()`.
  - Row 3: Genre pills (unchanged, still shows when tab !== rehearsal/events)

### Notifications (`/notifications`) — IMPROVED
- Unread item visual distinction: both `<a>` (with route) and `<div>` (no route) versions now have `border-l-2 border-primary-500 bg-primary-900/20` when `!n.read`, and `border-l-2 border-transparent` when read
- Unread title: `font-bold text-ink`; read title: `font-semibold text-ink-2` (slight de-emphasis)
- Unread dot: added `ring-2 ring-primary-500/20` halo around the `w-2 h-2 rounded-full bg-primary-500` dot
- All TS signal bindings verified correct: `loading()`, `notifications()`, `groupedNotifications()`, `hasUnread()`, `deleting()`, methods `markAllRead()`, `deleteAll()`, `typeIcon(n.type)`, `getRoute(n)`. Note: `navigateTo(n, router)` is NOT called in the template — the template uses `[routerLink]="getRoute(n)"` instead, which is valid.

## Profile UX enrichment pass — 2026-07-22 (venue + teacher detail pages)

### Venue Profile (`/venues/:id`) — IMPROVED
- Capacity: removed from small tag row; added prominent badge below address: `inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-500/10 border border-primary-500/25` with people-group SVG + "Aforo: N personas" text in `text-sm font-bold text-primary-400`
- Genres section: `flex flex-wrap` → `flex overflow-x-auto no-scrollbar gap-2 pb-1` with `flex-shrink-0` on each chip (horizontal scroll on mobile)
- Map placeholder card: new `card-flat p-4 flex items-center gap-4` with `w-11 h-11 rounded-xl bg-primary-500/10` icon container, city/address text, "Ver mapa →" link to `maps.google.com/?q=` (plain string concat, NOT `encodeURIComponent` — not available in Angular templates)
- Contact sidebar card: new `card-flat overflow-hidden` card above Ficha with icon-prefixed rows for phone and email. Each row: `flex items-center gap-3 px-4 py-3 hover:bg-dark-700/50` with `w-8 h-8 rounded-lg bg-dark-700` icon badge (phone SVG / email SVG) + label + value in `text-primary-400`
- Share button text: "Copiado" → "¡Enlace copiado!" (desktop) and "¡Copiado!" (mobile compact)
- Mobile CTA bar primary button: "Contactar" → "Reservar / Contactar"
- Desktop action column: "Contactar" → "Reservar / Contactar"
- Review list stars: upgraded from `★` text characters to inline SVG stars (filled/empty controlled by `[class.text-primary-500]` / `[class.text-dark-600]`) with `aria-label="N de 5 estrellas"`

### Teacher Profile (`/teachers/:id`) — IMPROVED
- Instrument badge: changed from inline `<p>` text to distinct badge container: `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-700 border border-dark-600` with music note SVG + bold name + experience years inline
- Specialty badge: NEW — `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary-900/40 border border-primary-500/20 text-xs font-semibold text-primary-400` with lightbulb SVG. Shows `teacher()!.specialty` if field has data
- Availability section: NEW — conditional `card-flat p-5` block that appears if `teacher()!.availability` has data. Renders `teacher()!.availability?.split(',')` as colored pills: `px-3 py-1.5 rounded-full text-xs font-bold bg-primary-500/15 text-primary-400 border border-primary-500/25`
- Review form stars: upgraded from text `★` buttons to filled/empty SVG icon buttons — filled: `bg-primary-500 border-primary-500 text-white`, empty: `bg-dark-700 border-dark-600 text-ink-muted`. `role="group"` + `aria-label` on container
- Review list stars: same SVG upgrade with `aria-label="N de 5 estrellas"` on wrapper span
- Sidebar price card: `text-3xl` → `text-4xl` + `€` as separate `text-lg font-black` span + `/hora` suffix. Much more prominent
- Ficha: added `specialty` row (conditional) between `instrument` and `city` rows
- Share button text: "Copiado" → "¡Enlace copiado!" (desktop) / "¡Copiado!" (mobile compact)
- `encodeURIComponent` GOTCHA: Cannot be used in Angular templates — not a component method. Use plain string concatenation for Google Maps URLs.

## Pages still with known technical debt

- Map: component file not found (may not exist yet)
- Legal pages: not design priority
- not-found: already has btn-primary CTA — no changes needed
- cookie-banner: correctly positioned at bottom-16 md:bottom-0 — no changes needed
- post-detail: already accessible — no changes needed

## Known patterns established

- Empty states: use SVG icon in `rounded-2xl bg-dark-800 border border-dark-600` 48x48–64x64 container, not emojis. ALWAYS include `border border-dark-600`.
- Profile avatars in lists AND hero: use `bg-primary-500 text-white` for initials fallback — NEVER `bg-dark-750 text-ink-2` or `bg-dark-700 text-primary-400` (both fail WCAG AA)
- Section labels in sidebars: use `section-label` class
- Location display: include location pin SVG before city name
- Sidebar "ver todos" links: `text-[10px] font-semibold text-primary-400 hover:text-primary-500`
- Tab pills: use `genre-pill-active` / `genre-pill-inactive` from styles.css
- `btn-accent` is defined as an alias for `btn-primary` in styles.css — both are valid
- Do NOT use hardcoded `style="background:#a0442a"` — use `class="bg-primary-500"`
- NEVER use `bg-green-500` for availability/success indicators — use `bg-signal-green`
- For `hidden sm:inline-flex` pattern: use `hidden sm:inline-flex` (not `hidden sm:flex`) when toggling visibility of a `btn-primary` element, since `btn-primary` already sets `inline-flex`
- BANNED non-existent color classes: `text-ink-3`, `text-ink-2`, `text-dark-500` — use `text-ink-muted` instead. These produce invisible text.
- Toast initials avatars in navbar: `bg-primary-500 text-white` (same pattern as profile avatars)
- FavoritesComponent has no public reload method — error state recovery should use `routerLink` navigation, not a click handler
- Filter pill containers should use `flex overflow-x-auto pb-1 no-scrollbar snap-x` with `flex-shrink-0 snap-start whitespace-nowrap` on each pill — never `flex-wrap` for type selectors on mobile
- Profile desktop action button columns: always add `w-full` to all buttons so they fill the 44 sidebar column cleanly
- Do NOT use Angular pipes that don't exist in the project (e.g. `pureFilter`). When per-item filtering is needed in template, use `@for` + `@if (v.id === signal())` nesting — always safe.
- Angular apply modals: use `applyingTo` WritableSignal as the open state. Backdrop click: `(click)="applyingTo.set(null)"` on the overlay div; inner div: `(click)="$event.stopPropagation()"`. Show vacancy details inside modal via `@for (v of openVacancies(); track v.id) { @if (v.id === applyingTo()) { ... } }`.
- Discovery grids (musicians, bands): `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3` — never horizontal-scroll strips on mobile for primary discovery content. Cards use `card p-4 text-center hover:-translate-y-0.5 hover:shadow-lg active:scale-95 group`.
- Home hero search bar: terracotta gradient `linear-gradient(135deg, #2d1109 0%, #1c0e08 55%, #120c09 100%)` with `border: 1px solid rgba(160,68,42,0.3)`. Fake search input links to `/search`. City chips below.
- Home category quick-nav: `grid grid-cols-3 sm:grid-cols-6 gap-2` — 3×2 on mobile, 6×1 on desktop. Each cell: icon in `w-9 h-9 rounded-xl bg-primary-900` container + label below.
- Vacancy open status: green `w-9 h-9 rounded-xl bg-signal-gBg border border-signal-green/25` icon container with `tag-green` "Abierta" badge + `w-2.5 h-2.5 rounded-full bg-signal-green` dot at `-top-1 -right-1`. Closed vacancies: `w-8 h-8 rounded-xl bg-dark-700 border border-dark-600` gray container + `w-2 h-2 rounded-full bg-ink-muted/40` dot + 50% opacity on content.

## Redesign pass — 2026-07-22 (Home + Band Vacancies)

### Home (`/home`) — REDESIGNED (discovery layout overhaul)
- Added warm terracotta hero section at top of main column: `linear-gradient(135deg, #2d1109 0%, #1c0e08 55%, #120c09 100%)` card with search bar fake input (links to `/search`) + popular cities chips
- Added category quick-nav grid below hero: 6 links (`Músicos, Bandas, Salas, Profesores, Ensayo, Equipo`) as `grid grid-cols-3 sm:grid-cols-6 gap-2` with icon containers and labels
- Musicians section: changed from cramped `flex overflow-x-auto w-28` to `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3` — w-14 h-14 avatars, hover reveal "Ver perfil →" text
- Bands section: same grid change, retained `looking_for` green dot at `absolute top-3 right-3` with `ring-2 ring-dark-800` for visual clarity, hover reveal "Ver banda →"
- Loading skeletons for musicians/bands: updated to match new grid layout (`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`)
- Empty states for musicians/bands: upgraded from bare text to `card p-8` with icon container + two-line message + CTA button
- Gear item cards: added `hover:-translate-y-0.5` lift
- Gear empty state: upgraded to two-line message with icon

### Band Profile (`/bands/:id`) — VACANCIES UX PASS
- Open vacancies: each row now has a `w-9 h-9 rounded-xl bg-signal-gBg border border-signal-green/25` icon container (music note icon) with `w-2.5 h-2.5 bg-signal-green` dot at `-top-1 -right-1`; `tag-green` "Abierta" badge next to instrument name
- Closed vacancies: gray `w-8 h-8 bg-dark-700` icon with `bg-ink-muted/40` dot; "Cerrada" badge; content at 50% opacity
- Apply form moved from inline to modal overlay: `fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm`. Shows vacancy name in header via `@for + @if` pattern. Click backdrop to dismiss.
- Vacancy header: consolidated open count into `tag-accent` + total applications count pill for owners
- Vacancies empty state: replaced bare 2-line text with icon container (`w-11 h-11 rounded-xl bg-dark-750 border border-dark-600`) + two-line message + conditional owner/visitor copy
- Applications section: musician message now shown in quoted `bg-dark-700/50 rounded-lg px-3 py-2 border border-dark-600 line-clamp-2` block; vacancy applied-for shown with music icon; avatar has `border-2 border-dark-700`
- Members section: each row now has a small `w-6 h-6 rounded-lg bg-primary-900` music icon badge before the name
- `pureFilter` pipe reference removed — do not use non-existent pipes
