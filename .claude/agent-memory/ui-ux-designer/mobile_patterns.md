---
name: mobile-patterns
description: Mobile-specific layout patterns and conventions for Bandyou (primary access channel)
metadata:
  type: project
---

## Core mobile layout constants

- Top navbar: fixed, 64px height → all pages need `padding-top:64px`
- Bottom nav: fixed, ~64px height → all pages need `padding-bottom:80px` minimum
- Pages with fixed mobile CTA bars (profile pages): need `padding-bottom:144px`
- Bottom nav z-index is high; mobile CTA bars use `bottom-16 z-30`
- Chat uses `fixed inset-x-0 top-16 bottom-16 md:bottom-0 lg:left-56` — no page padding needed

## Sidebar-to-horizontal-strip pattern (home page)

When a sidebar stacks content vertically below main content on mobile, convert each section to a horizontal-scroll strip:

```html
<!-- Section wrapper -->
<div class="px-4 pt-4 pb-3 lg:px-0 lg:pt-0 lg:pb-0 border-b border-dark-600 lg:border-b-0">
  <!-- Header with title + "Ver todos →" link -->
  
  <!-- Horizontal scroll list -->
  <div class="flex lg:flex-col gap-3 overflow-x-auto pb-2 no-scrollbar snap-x snap-mandatory lg:gap-2 lg:overflow-x-visible lg:pb-0 lg:snap-none">
    <!-- Each card -->
    <a class="... flex-shrink-0 min-w-[180px] snap-start lg:min-w-0">...</a>
  </div>
</div>
```

For image-heavy grid sections (Tienda): `w-[130px] lg:w-auto` on cards, `flex lg:grid lg:grid-cols-2` on container.

`no-scrollbar` is defined in `src/styles.css` — do not re-define it.

## Profile mobile CTA bar pattern — FULLY IMPLEMENTED (2026-07-14)

Applied to ALL five profile types: musician, band, rehearsal, teacher, venue.

1. Desktop action column: `class="hidden sm:flex sm:flex-col gap-2 flex-shrink-0 sm:pt-14 sm:w-44"`
2. Fixed CTA bar for mobile (placed before the closing `}` of the `@else` block):

```html
<div class="fixed bottom-16 left-0 right-0 z-30 bg-dark-800/98 backdrop-blur-md border-t border-dark-600 px-4 py-3 flex gap-3 sm:hidden">
  <button class="btn-primary text-sm flex-1">Primary action</button>
  <button class="btn-secondary text-sm flex items-center justify-center gap-1.5 px-4">[fav SVG] Guardar</button>
  <button class="btn-secondary text-sm flex items-center justify-center gap-1.5 px-4">[share SVG] Compartir</button>
</div>
```

3. Page container: `style="padding-top:64px; padding-bottom:144px"`
4. Any duplicate action buttons in the right sidebar column: add `hidden sm:block` class.

## Hero pattern — unified across all profile types (2026-07-14)

All five profile types (musician, band, venue, teacher, rehearsal) now use:
- Cover strip: `h-32 sm:h-44` with `linear-gradient(135deg, avatarColor+'30' 0%, #fef0e8 100%)`
- Avatar overlapping: `-mt-12 sm:-mt-14` with `border-4 border-dark-900 shadow-xl`
- Info section: `pt-14 sm:pt-16` to align with bottom of avatar

## Responsive bottom padding — profile pages

Profile pages (`musician-profile`, `band-profile`, `venue-profile`, `teacher-profile`, `rehearsal-profile`) use a mobile fixed CTA bar at `bottom-16`. The page outer div must use:

```
pb-36 sm:pb-20 md:pb-8
```

NOT `pb-36 sm:pb-8` — between 640px and 768px the bottom nav is still visible (`md:hidden`) but the CTA bar is hidden (`sm:hidden`). `sm:pb-8` (32px) does not clear the 64px bottom nav. `sm:pb-20` (80px) gives the correct clearance.

## Touch targets

- Minimum 44×44px for all interactive elements
- Conversation rows in inbox: `min-h-[64px]`
- Pill buttons (onboarding instrument/genre selection): `py-2.5 min-h-[44px]`
- Icon-only buttons: always `min-w-[44px] min-h-[44px] flex items-center justify-center`
- Desktop navbar icon buttons: use `min-w-[44px] min-h-[44px] flex items-center justify-center` even though they are desktop-only — hybrid devices benefit
- Image navigation arrows (gear-detail, carousels): use `w-11 h-11` (44px) not `w-9 h-9`
- Dot indicators in image carousels: wrap `w-2 h-2` dots in `w-8 h-8` parent buttons with `flex items-center justify-center` — never use the dot element itself as the tap target
- Secondary action buttons (Vendido, Cancelar status buttons): `py-2 min-h-[36px]` is acceptable for secondary in-list actions when 44px would dominate the layout

## Form fields on mobile

- Multi-column grids on mobile: prefer `grid-cols-1 sm:grid-cols-N` over `grid-cols-2 sm:grid-cols-3`
- Exception: 2-column grids for very short fields (date/time side by side) are acceptable
- Type selector pills: use `flex overflow-x-auto no-scrollbar snap-x` + `flex-shrink-0 snap-start` on items instead of `flex-wrap` to avoid multi-line pill groups
- Number inputs: always add `inputmode="decimal"` for prices/rates, `inputmode="numeric"` for integer fields (capacity, years)
- Search inputs: add `type="search"` for correct iOS keyboard with X clear button
- Band member form rows: use card-based vertical layout (`flex-col gap-2` within a card) — never put name + select + delete button in a horizontal `flex` row (overflows at 320px)
- 7-day availability pickers: use `grid grid-cols-7 gap-1` not `flex gap-1.5` — 7 × 44px buttons in flex overflows 320px viewport

## Typography on mobile

- Hero headings: `text-3xl sm:text-4xl` (not `text-4xl` directly — too large at 320px)
- Container padding: `px-5 py-8 sm:py-12` not `px-6 py-12`
- Landing hero headline clamp: `text-[clamp(2.4rem,8vw,5.5rem)]` — 2.8rem minimum was too large for "La red musical" at 320px

## Landing page specifics

- Footer: `pt-8 pb-24 sm:pb-8` — the 96px bottom padding (pb-24) clears the mobile bottom nav bar. Do NOT use `py-8` which leaves the footer content obscured by the nav.
- Hero section `pt-20` (80px) is sufficient to clear the 64px fixed navbar — no separate wrapper div needed for landing since the first `<section>` has the padding.

**Why:** Mobile is the PRIMARY access channel for Bandyou users.
**How to apply:** Apply these patterns first when designing or reviewing any feature, before considering desktop layout.
