---
name: Bandyou Page Redesign Status
description: Which pages have been redesigned and what state they are in
type: project
---

## Priority pages — status as of 2026-04-28

### Landing (`/landing`) — DONE
Strong editorial design with serif/sans headline mix, role pills on desktop, bento category grid, stats bar, CTA section.

### Home (`/home`) — DONE
Editorial header with date + greeting, profile nudge card, event highlight, anuncios list, musicians/bands side-by-side grid, sticky right sidebar with events/shop/rehearsals/teachers/venues.
Fix applied: replaced `style="background:#a0442a"` on musician/band avatars with `class="bg-primary-500"`.

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

## Other pages not yet prioritized

- Events (list + detail + form)
- Map
- Notifications
- Onboarding (deliberate Swiss/brutalist style — leave as-is)

## Known patterns established

- Empty states: use SVG icon in `rounded-2xl bg-dark-700 border border-dark-600` 48x48 container, not emojis
- Profile avatars in lists AND hero: use `bg-primary-500 text-white` for initials fallback — NEVER `bg-dark-750 text-ink-2` or `bg-dark-700 text-primary-400` (both fail WCAG AA)
- Section labels in sidebars: use `section-label` class
- Location display: include location pin SVG before city name
- Sidebar "ver todos" links: `text-[10px] font-semibold text-primary-400 hover:text-primary-500`
- Tab pills: use `genre-pill-active` / `genre-pill-inactive` from styles.css
- `btn-accent` is defined as an alias for `btn-primary` in styles.css — both are valid
- Do NOT use hardcoded `style="background:#a0442a"` — use `class="bg-primary-500"`
