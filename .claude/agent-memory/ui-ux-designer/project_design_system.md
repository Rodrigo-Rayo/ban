---
name: Bandyou Design System — Palette and Conventions
description: Critical design system details for Bandyou — warm-tone light palette (NOT dark), custom component classes, layout shell
type: project
---

## Palette — warm-tone LIGHT (not dark despite naming)

- `dark-900` = `#f4efe6` — warm cream background
- `dark-800` = `#fffef9` — warm white for cards
- `dark-750` = `#f0e8d8` — tinted surfaces
- `dark-700` = `#ede3d0` — inputs / hover
- `dark-600` = `#d8ccb8` — borders
- `primary-500` = `#a0442a` — terracotta (main brand color)
- `primary-900` = `#fef0e8` — light tinted active backgrounds
- `ink` = `#111111` — editorial black text
- `ink-muted` = `#9c9088` — muted text

**Why:** Despite "dark-*" naming, this is a warm cream/parchment light palette. Never use dark-mode assumptions.

**How to apply:** Use `bg-dark-900` for page backgrounds, `bg-dark-800` for cards. Use `bg-dark-700` for inputs/hover states.

## Component classes (src/styles.css @layer components)

`btn-primary`, `btn-accent` (same as primary), `btn-secondary`, `btn-ghost`, `btn-night`
`card`, `card-flat`, `card-night`
`input-field`
`tag`, `tag-accent`, `tag-green`, `tag-night`
`nav-item`, `nav-item-active`, `nav-item-inactive`
`section-label`, `avatar`, `badge`, `empty-state`, `section-empty`
`display-serif` (Instrument Serif italic)
`tab-btn-active`, `tab-btn-inactive`, `genre-pill-active`, `genre-pill-inactive`
`no-scrollbar` (added session 2026-04-28)
`text-white-muted`

## Layout shell

NavbarComponent (top, 64px height) + SidebarComponent (left, `lg:w-56`) + `<div class="lg:pl-56">` wrapping `<router-outlet>`.
Pages use: `style="padding-top:64px; padding-bottom:80px"` for mobile nav clearance.

## Angular template gotchas

- Never use escaped slashes in `[class.]` bindings: `[class.hover:border-primary-500\/40]` will break compilation
- Never use `!` prefix in `[class.!text-...]` bindings — use direct class names without `!`
- Tailwind classes with `/` opacity modifiers (e.g. `primary-500/30`) work fine in static `class=""` attributes
