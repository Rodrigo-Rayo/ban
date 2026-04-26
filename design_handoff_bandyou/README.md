# Handoff: BandYou — Plataforma

## Overview

BandYou es un directorio vivo de la escena musical (empezando por Madrid): **músicos, bandas, locales de ensayo, salas de conciertos, estudios, profesores y agenda de eventos** en una misma plataforma. Este paquete contiene los diseños de referencia de las 9 pantallas principales del producto v1, listos para ser implementados en el codebase Angular existente del proyecto (`bandyou/`).

El tono visual es **"edición vinilo"** — editorial (serifa display + mono + condensada), paleta crema / tinta con acento ámbar eléctrico, y una serie de primitivas gráficas recurrentes (discos de vinilo, sellos de goma, fundas rayadas, placeholders con trama diagonal).

---

## About the Design Files

Los archivos dentro de `reference/` son **referencias de diseño creadas en HTML + React (vía Babel en-browser)** — son prototipos visuales que muestran el look & feel y el comportamiento intencionado, **no código de producción para copiar directamente**.

La tarea del desarrollador es **recrear estos diseños dentro del proyecto Angular existente** (`bandyou/`, Angular 17+ standalone components + Tailwind + Supabase), aprovechando la estructura de features ya creada (`src/app/features/landing`, `.../onboarding`, `.../home`, `.../search`, `.../chat`, `.../events`, `.../musicians/musician-profile`, `.../bands/band-profile`, `.../venues/venue-profile`, `.../rehearsal-spaces/rehearsal-profile`, `.../teachers/teacher-profile`).

Los JSX son solo referencia visual — el código real debe ser Angular templates + TS + Tailwind, siguiendo las convenciones del codebase.

---

## Fidelity

**Alta fidelidad (hi-fi).** Los mockups incluyen colores exactos, tipografías finales, tamaños, espaciados y composiciones definitivas. El desarrollador debe reproducir los layouts, jerarquía tipográfica y paleta **tal cual**, usando Tailwind + CSS custom classes cuando haga falta (ver sección "Design Tokens" abajo).

Lo que **sí** se espera adaptar al codebase:
- Estructura de componentes → Angular standalone components, no React.
- Estado local → Angular signals o RxJS, no `useState`.
- Rutas → Angular Router (ya definidas en `app.routes.ts`).
- Datos → desde Supabase (`SupabaseService` ya existente), no hardcodeados.
- Iconos → extraer los SVGs inline del `Icons` object en `reference/shared.jsx` y convertirlos en componentes standalone reutilizables (o usar Angular inline templates).

---

## Design Tokens

Todos los valores provienen de `reference/tokens.js`. **Añadir estos como CSS custom properties globales en `src/styles.css` y exponerlos en `tailwind.config.js` como colores / fontFamily extendidos.**

### Colores

| Token    | Hex       | Uso |
|----------|-----------|-----|
| `ink`    | `#0f0d0b` | Texto principal, fondos oscuros, bordes fuertes |
| `ink2`   | `#1f1a15` | Texto principal alternativo |
| `ink3`   | `#3a3229` | Texto secundario en sidebars |
| `muted`  | `#7a6f62` | Texto muted, meta-info mono |
| `line`   | `#d9cfbd` | Bordes suaves, separadores |
| `line2`  | `#c4b99f` | Bordes de inputs y chips |
| `paper`  | `#f5f1ea` | Fondo principal (crema) — **tweak user aplicó este valor** |
| `paper2` | `#e4d9c1` | Fondo de paneles secundarios |
| `paper3` | `#d6c9ac` | Fondo terciario |
| `white`  | `#f6efda` | Superficies elevadas / cards |
| `cream`  | `#f1e8d1` | Texto sobre fondos oscuros |
| `accent` | `#d9532b` | Acento ámbar eléctrico — CTAs, highlights, enlaces — **tweak user aplicó este valor** |
| `accent2`| `#b83a12` | Acento oscuro (borders internos en CTAs oscuras) |
| `accentSoft` | `#e88a5f` | Acento claro (labels sobre fondo oscuro) |
| `plum`   | `#6b3d5c` | Tono extra (avatares, pins de mapa) |
| `green`  | `#4a6b3f` | Tono extra |
| `blue`   | `#3d4f6b` | Tono extra |

El producto ofrece 5 variantes de acento seleccionables en el panel de Tweaks (referencia) — para v1, quedarse con el ámbar por defecto.

### Tipografía

Cargar desde Google Fonts en `index.html`:

```html
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:wght@400;500;600&family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Oswald:wght@300;400;500&display=swap" rel="stylesheet" />
```

| Token     | Stack | Uso |
|-----------|-------|-----|
| `display` | `'Bodoni Moda', 'Playfair Display', Georgia, serif` | Titulares grandes en landing, hero, nombres de secciones |
| `serif`   | `'Instrument Serif', Georgia, serif` | Titulares de pantallas interiores, nombres propios |
| `sans`    | `'Inter', system-ui, sans-serif` | Body, UI general |
| `mono`    | `'JetBrains Mono', ui-monospace, Menlo, monospace` | Meta-info, tags, números, labels |
| `cond`    | `'Oswald', 'Inter', sans-serif` | Botones, nav items, labels condensadas (UPPERCASE, letter-spacing 1.2–1.4) |

**Convención clave:** los titulares grandes mezclan regular + italic en colores distintos. Patrón típico: `"Texto normal "` + `<span italic color=accent>"palabra destacada"</span>`. La itálica de Bodoni Moda es central — no sustituir por un oblique sintético.

### Escala tipográfica (tamaños reales usados)

- Hero landing: 132px / line 0.88 / letter -4 / display 600
- H2 sección: 96px / line 0.9 / letter -2.5 / display 600
- H2 secundario: 80px / line 0.92 / letter -2 / display 600
- Título pantalla: 72px / line 0.95 / letter -1.5 / serif 400
- Title card grande: 42px / letter -1 / display 600
- Título sección: 32–36px / letter -0.5 / display o serif
- Item grande: 24–28px / letter -0.3 to -0.5 / display 600
- Body: 13–15px / line 1.4–1.6 / sans 400
- Meta/mono: 10–11px / letter-spacing 1–1.5 / UPPERCASE
- Botones: 11–14px / Oswald 500 / UPPERCASE / letter-spacing 1.2

### Espaciado

Padding estándar de secciones: 40–80px laterales, 56–100px verticales en landing. Interior de cards: 14–24px. Gap entre items: 4/6/8/10/12/16/20/24/32/40/60px (usar escala Tailwind normal; NO border-radius redondeados — el diseño es cuadrado).

### Bordes y sombras

- **Border radius: 0 casi en todo.** Pocas excepciones: chips de pastilla (radius 24px en onboarding), badges de contador (radius 8px), avatares (50% círculo), avatares internos del vinilo. NO usar `rounded-lg/xl/2xl` de Tailwind.
- Bordes: 1px solid en `line`, `line2` o `ink`.
- Sombras: mínimas. Solo en tooltips/popovers: `0 12px 40px rgba(0,0,0,0.2)`.

---

## Primitivas compartidas (recrear como componentes Angular)

Extraer estos de `reference/shared.jsx` y reimplementar como componentes standalone en `src/app/shared/components/`:

### 1. `WordmarkComponent`
Logo "band·you" — `band` en Bodoni 600, punto medio `·` en cursiva color acento, `you` en Bodoni 600. Letter-spacing -0.8. Prop `size` (default 22px).

### 2. `VinylComponent`
Disco de vinilo — gráfica central del producto. Círculo con gradiente radial negro (`#2a2620 → #141210 → #0a0908`), 8 ringuitos concéntricos de `rgba(255,255,255,0.035)`, highlight cónico rotado 210°, label central coloreado (40% del diámetro) con nombre en Bodoni + sublabel mono, agujero central del color paper. Props: `size`, `label`, `sublabel`, `tone` (amber/plum/green/blue/ink/cream), `spin` (boolean, CSS animation 8s linear infinite). Ver implementación exacta en `shared.jsx`.

### 3. `SleeveComponent`
Funda de álbum — fondo con `repeating-linear-gradient` según tono, inset shadow. Envuelve un `<Vinyl>` en cards de bandas.

### 4. `AvatarComponent`
Círculo con iniciales. Bg por tono, color cream, font display 600 al 40% del tamaño. Borde de 3px paper + 1px ink (efecto "sello"). Initials: primeras letras de las 2 primeras palabras del nombre.

### 5. `TagComponent`
Chip pequeño: font mono 10px, UPPERCASE, letter-spacing 1.2, padding 3px 8px, border 1px. Variantes: `default` (bg transparent o ink si active), `accent` (bg accent), `stamp` (transparent, accent border + text).

### 6. `MetaComponent`
Línea de meta-info: `['LAVAPIÉS', 'EST. 2026', 'ABIERTA']` → `LAVAPIÉS ◆ EST. 2026 ◆ ABIERTA` en mono 10px, color muted, separador rombo `◆` a 40% opacity.

### 7. `StampComponent`
Sello de goma — texto Oswald 11px letter-spacing 2, UPPERCASE, border 2px del color, rotación configurable (-4° por defecto), bg transparente. Se usa en overlay absolute sobre el vinilo del hero.

### 8. `BtnComponent`
Botón. Props `variant` (primary/accent/ghost/text), `size` (sm/md/lg), `icon`. Oswald 500, UPPERCASE, letter-spacing 1.2, NO rounded. Padding: sm 6×12, md 10×18, lg 14×24.

### 9. `PhotoPlaceholderComponent`
Placeholder rayado — `repeating-linear-gradient(135deg, c1 0 20px, c2 20px 40px)` según tono, con caption en mono al bottom `[ label ]`. Se usa en TODAS las fotos de usuarios/bandas/locales hasta que lleguen imágenes reales.

### 10. `WaveformComponent`
Render de barras para preview de audio. 48 barras de 2px de ancho, altura random-deterministic con `Math.sin(i * 1.7 + 3) * 0.7 + 0.3`, reproducidas → color accent, no reproducidas → color line2.

### 11. `Icons` (set)
15 iconos SVG inline, todos 16×16, stroke 1.5, `fill="none"` o `fill="currentColor"`. Lista: search, chat, map, calendar, heart, heartFill, home, bell, user, pin, close, check, send, arrow, back, plus, star, compass, vinyl, ticket, play, pause. Copiar los paths exactos de `shared.jsx` → crear un `IconComponent` con un input `name`.

---

## Screens / Views

Hay 9 pantallas. Cada una se mapea a un feature ya presente en `bandyou/src/app/features/`.

---

### 01 · Landing → `features/landing/`

**Propósito:** marketing pública, previa al registro.

**Layout (canvas 1280×2600):**

1. **Nav bar** (borderBottom line, padding 22×44)
   - Left: Wordmark size 24
   - Center: 5 items nav en Oswald uppercase ("Músicos", "Bandas", "Espacios", "Profes", "Agenda") con gap 32
   - Right: Btn "Entrar" (text) + Btn "Unirse" (primary sm)

2. **Hero** (padding 56×44, grid 1fr 340px, gap 60)
   - Left col: Meta `['LADO A', 'MADRID · EST. 2026', 'CARA ABIERTA']` → H1 132px tres líneas (`"La escena / suena mejor / cuando conecta."`, segunda en italic 400, "conecta." en color accent) → párrafo 17px (max 540w) → botones lg (accent "Entrar en la escena" + ghost "Explorar sin registro") → Meta `['GRATIS', 'ESPAÑA · EUROPA PRÓXIMAMENTE']`
   - Right col: `<Vinyl size=320 spin label="Side A" sublabel="Madrid · 33⅓" tone=amber>` con 2 Stamps posicionados absolute: top-right "3.241 Perfiles" (ink, -8°) y bottom-left "Sin Algoritmo Tóxico" (accent, +6°)

3. **Marquee** (borderTop/borderBottom 2px ink, bg ink, color cream, padding 18px vertical)
   - Loop infinito de barrios separados por `◆` accent: "Lavapiés ◆ Malasaña ◆ Vallekas ◆ Chamberí ◆ La Latina ◆ Carabanchel ◆ Tetuán ◆ Chueca" × 4.
   - Bodoni italic 32px. Animación `translateX(0 → -25%)` en 50s linear infinite.

4. **Catálogo** (padding 72×44, borderBottom line)
   - Header: grid 220px/1fr. Left: Meta `['01', 'EL CATÁLOGO']` + título Oswald 60px 300 UPPERCASE 3 líneas "Quién / está / dentro". Right: párrafo 16px max 560w.
   - Grid 5 columnas × 1 fila de cards (border 1px ink). Cada card: número mono accent (01-05) + contador mono muted, centro con `<Vinyl size=120 tone>`, abajo nombre display 28px + descripción 12px muted.
   - Datos: `01 Músicos 3.241 amber` / `02 Bandas 687 plum` / `03 Espacios 174 ink` / `04 Profesores 156 green` / `05 Agenda 42/sem blue` con descripciones cortas.

5. **Cómo funciona** (padding 80×44, grid 1fr 1fr gap 60, borderBottom line)
   - Left: Meta `['02', 'CARA B']` + H2 80px 3 líneas "Encuentras. / Hablas. / Tocas." (segunda italic, tercera color accent).
   - Right: 4 pasos en grid 80px/1fr, separados por borderTop line. Número display italic accent 36px + título Oswald 22px UPPERCASE + desc 14px muted. Pasos: "01 Creas tu ficha", "02 Exploras el directorio", "03 Mensaje directo", "04 Reserva compartida".

6. **Espacios** (padding 80×44, bg ink, color cream)
   - Meta accent `['03', 'ESPACIOS']` → H2 96px "Un solo mapa / para todo lo que / suena en Madrid." (solo italic, todo accent) + párrafo max 400w.
   - Grid 4 columnas gap 16, margin-top 48: cada card borderTop 1px #3a332c, Meta accent (nº espacios) + título display 28px + subtítulo 12px muted (#9a9080). Tipos: Sala de conciertos, Local de ensayo, Estudio grabación, Luthier & alquiler.

7. **Pull quote testimonio** (padding 90×44, bg paper2)
   - Meta centrada `['TESTIMONIO', 'LAVAPIÉS']`.
   - Blockquote Bodoni italic 60px, max 960w centrado. Palabra "miércoles" en accent color regular 600 (no italic).
   - Avatar Iván Torres tone plum + nombre + Meta `['GUITARRA', 'POST-PUNK']`.

8. **Footer CTA** (padding 100×44, bg ink)
   - H2 112px "Dale a play. / La escena te espera." ("play." italic, segunda línea accent).
   - Right col: párrafo 15px color #c9bfa4 + Btn accent lg "Crear mi ficha" con padding 16×30.
   - Bottom bar (margin 80, padding 28, borderTop #3a332c): 3 items mono 10px color #8a8070 UPPERCASE: "© BandYou · Madrid, 2026", centro flavor text, "Privacidad · Términos · Prensa".

9. **Grain overlay** en todo el viewport: `position absolute inset 0 pointer-events none opacity 0.5 mix-blend-mode multiply` con dos radial-gradients muy sutiles.

---

### 02 · Onboarding → `features/onboarding/`

**Propósito:** 6 pasos para crear ficha.

**Layout (canvas 1100×720):** frame vertical con header, barra de progreso de 6 segmentos, contenido centrado, footer con CTA.

**Header** (20×40, borderBottom line): Wordmark · Meta `PASO 0N / 06, {nombre paso}` · botón "← Atrás" mono 11px.

**Barra progreso:** 6 segmentos iguales de altura 3px, segmentos ≤ current paso en accent, resto en line. Separador 1px paper entre segmentos.

**Content area** (padding 48×60, flex center): h2 Instrument Serif 52px letter-spacing -1, con palabra clave en italic color accent (`"¿Quién eres?"`, `"¿Qué tocas?"`, `"¿Qué suena?"`, `"¿Qué nivel?"`, `"¿Por dónde te mueves?"`, `"Hola {rol}. Ya eres parte."`). Luego subtítulo 14px muted y el control específico.

**Footer** (20×40, borderTop line): Meta `['PUEDES EDITAR TODO MÁS TARDE']` · Btn accent lg "Siguiente" (→ "Entrar" en paso final).

**Pasos:**

- **0 Rol:** Choice 2×2 — Músico (default) / Banda / Profesor / Local de ensayo. Card de 18×20 padding, bg white (o ink si active, color paper), border 1px. Título Instrument Serif 20px + desc 12px muted.
- **1 Instrumento:** Chips pastilla (border-radius 24). Lista: Guitarra, Bajo, Batería, Voz, Teclados, Piano, Violín, Saxo, Trompeta, DJ / Producción, Percusión, Contrabajo, Armónica, Ukelele, Cello. Active → bg accent color paper. Multi-select.
- **2 Estilo:** Chips pastilla, active → bg ink. Hasta 5. Lista: Rock, Indie, Post-punk, Jazz, Metal, Pop, Hip-hop, Flamenco, Funk, Soul, Blues, Electrónica, Clásica, Reggae, Hardcore, Folk, Experimental, Latin, Trap.
- **3 Nivel:** 5 cards grid. Cada una: "LV.N" mono + Label Instrument Serif 18 + desc 11px. 1 Empezando / 2 Amateur / 3 Intermedio (default) / 4 Avanzado / 5 Profesional.
- **4 Zona:** Grid 1.2fr 1fr. Left: SVG 300×260 mapa abstracto con rings concéntricos accent (40/80/120 radius, opacity 0.15/0.08/0.04, strokeDasharray 3 3), dot central, label "MALASAÑA" mono 9. Right: Meta BASE / MADRID CENTRO → serif 36 "Malasaña" → slider de radio con labels "RADIO DE MOVIMIENTO" / "5 KM accent", track 3px line con fill 30% accent y knob ink 13px. Labels "1 km / Madrid / Toda España".
- **5 Listo:** Center. "★ LISTO ★" mono accent letter-spacing 2 → Serif 72 "Hola {rol}. / Ya eres parte." ({rol} en italic accent) → párrafo 15px: "Hemos encontrado 23 perfiles cerca de ti. Una banda post-punk en Lavapiés busca alguien así." → 2 botones: accent lg "Explorar directorio" + ghost lg "Completar perfil".

**State:** `role, instruments[], styles[], level, zone, radius`. Persistir paso parcial si es posible.

---

### 03 · Home / Feed → `features/home/`

**Propósito:** tras login, feed del día.

**Layout (canvas 1440×960):** `[sidebar 220px] [main flex]` donde main es `[header] [body grid 1fr 320px]`.

**Sidebar (bg white, borderRight line, padding 24×18):**
- Wordmark 22 arriba.
- Navegación vertical: Inicio (active), Directorio, Mapa, Agenda, Espacios, Mensajes (badge 3 accent), Guardados. Items 9×10 padding, Oswald 14 UPPERCASE letter-spacing 1, icono 15px. Active: bg paper2, borderLeft 2px accent, icono accent.
- Bottom: mini card de usuario (padding 12, bg paper2, border line). Avatar tone ink + "Iván T." + Meta mono 9 "GUITARRA · LV.4".

**Header** (20×32, borderBottom line, flex between):
- Left: Meta `['JUEVES · 23 ABR', 'MADRID']` + H1 display 40px "Buenas, {Iván}." (nombre italic).
- Right: Search input 280w con borde ink, icono search, placeholder "Buscar músicos, bandas, espacios..." y hint mono "⌘K" a la derecha + Btn primary "Publicar" con icono plus.

**Body main col (padding 24×32, overflow auto):**

1. **Tabs**: "Cerca de ti" (default) / "Afines a tu estilo" / "Nuevos perfiles" / "Bandas con vacante". Oswald 13 UPPERCASE letter-spacing 1.4. Underline accent 2px para active. borderBottom 1px line en la fila.

2. **Feature card destacado** (bg ink, color cream, padding 28, grid 1fr 200px):
   - Left: Meta accent `['★ DESTACADO HOY', 'MADRID']` → display 42px "Los Perros Verdes / publican vacante." ("Perros Verdes" italic, "vacante." accent) → párrafo 13 color #c9bfa4 max 440w → 2 botones: accent "Ver banda" + ghost cream border #3a332c "Descartar".
   - Right: `<Vinyl size=180 tone=plum label="Perros Verdes" sublabel="Side A · 45" />` centrado.

3. **Meta `['MÚSICOS CERCA', 'ORDENADOS POR CERCANÍA']`**.

4. **Lista de tarjetas de músicos** (gap 12). Cada card: bg white border line, grid `[100px vinyl slot] [main pad 16×20] [right pad 16×20, borderLeft dashed line]`:
   - Slot izquierdo bg ink centrando `<Vinyl size=70 tone label sublabel>`.
   - Main: nombre display 24 + mono 10 muted " · {rol} · LV. {nivel}" en baseline alignment → Meta [zone, ...tags] → bio 13px ink2 lineheight 1.4 → línea "COMPARTÍS: {items join ' · '}" mono 11 muted con items en ink.
   - Right: mono zone UPPERCASE arriba + flex gap 6 abajo con Btn ghost sm "Ver ficha" + Btn primary sm "Escribir".

   Datos ejemplo:
   - Marta Vilches · Bajo · Voz · Lavapiés · Avanzado · POST-PUNK / SHOEGAZE / FINDES · plum · "Ex de Los Santos Vagos. Busco proyecto con material propio." · Shared: Slowdive, IDLES, Viva Belgrado, +1 más
   - Dani K. · Batería · Malasaña · Pro · INDIE / KRAUT / FLEXIBLE · amber · "Toco desde los 14. Abierto a jams y proyectos con vista larga." · Shared: Fontaines D.C., La Plata, +2 más
   - Laura M. · Sintetizadores · Tetuán · Intermedio · SYNTH-POP / AMBIENT · green · "Produzco en casa, quiero llevar lo mío a directo." · Shared: Carolina Durante, +1 más

5. **Sección "Bandas con vacante"** (margin-top 36, header display 32 borderBottom ink paddingBottom 10 + "VER TODAS →").
   - Grid 3 columnas gap 12. Card: bg white border line padding 14 → `<Sleeve tone height 150>` conteniendo `<Vinyl size 110 tone label sublabel>` → nombre display 20 + Meta [estilo, zone] + Tag accent con vacante.
   - Datos: Carrión / + Teclados / Shoegaze / Malasaña / plum · Nieve Roja / + Voz / Hardcore / Carabanchel / amber · La Tormenta / + Batería / Indie / La Latina / green.

**Right rail** (bg paper2, borderLeft line, padding 24×20, overflow auto):
- Meta `['ESTA SEMANA EN MADRID']` → display 26 "Agenda abierta" (abierta italic).
- Lista de eventos, cada uno: grid 56/1fr/auto, borderTop line entre items. Cuadrado fecha (padding 6 vertical, bg white, border ink): display 22 día / mono 9 muted mes UPPERCASE. Centro: título 13 fw 600 + Meta [lugar, hora]. Right: Tag tipo (JAM/OPEN/BOLO).
  - 23 ABR Jam indie @ Wurlitzer 22:00 JAM
  - 25 ABR Open stage @ El Sol 21:30 OPEN
  - 26 ABR Los Perros Verdes @ Siroco 21:00 BOLO
  - 27 ABR Jazz night @ Bogui 20:00 JAM
- Meta `['MENSAJES RECIENTES']` (marginTop 28 borderTop line). Lista: Avatar 32 + nombre 12 + preview 11 muted elipsis + badge unread accent. Items: Marta V. (2), Los Perros Verdes (1), Sala Siroco (0).

---

### 04 · Búsqueda → `features/search/`

**Propósito:** explorar directorio con filtros.

**Layout (canvas 1440×900):** `[filters sidebar 260px] [results grid]`.

**Sidebar (bg white, borderRight line, padding 20×20):**
- Wordmark 18.
- Meta `['FILTROS']` (pt 20 borderTop line).
- Grupos (gap 20 entre grupos):
  - **Busco**: Tag row: Músico (active) / Banda / Local / Profe.
  - **Instrumento**: chips mono 10, uppercase, padding 4×8. Multi toggle. Default Bajo active.
  - **Distancia**: slider 1-50km con accentColor accent. Labels "1 / Madrid / 50 km" mono 9.
  - **Nivel**: 5 botones grid, flex-1. "L1…L5" mono 11 padding 8×0. Default L3+L4 active.
  - **Estilos**: chips mono 10, active bg accent. Default Post-punk+Indie.
  - **Disponibilidad**: checkboxes accent-color: "Entre semana por la tarde", "Fines de semana" (default), "Flexible", "Solo online al principio".
- Btn primary md full-width "Aplicar filtros" + link text "Limpiar todo".

**Results area (padding 20×32, overflow auto):**
- Header flex between: left: Serif 36 "Bajistas cerca de ti" (Bajistas italic) + Meta `['247 RESULTADOS', 'ORDENAR POR: CERCANÍA', 'LAVAPIÉS · 5 KM']`. Right: segmented toggle LISTA (active bg ink color paper) / MAPA / CARDS (mono 11 UPPERCASE).
- Grid 3 columnas gap 12 de resultados. Card: bg white border line padding 16:
  - Top row flex gap 12: `<PhotoPlaceholder 60×60 tone label>` + nombre serif 18 / Meta `[role UPPERCASE, zone UPPERCASE]` + distance mono 10 muted ("1.2 km").
  - Row tags (mt 10 gap 6 flex-wrap).
  - Footer (mt 10 pt 10 borderTop line, flex between): Meta `[↗ dist]` + 3 icon buttons 6px padding: play (border line2), heart (border line2), chat (bg ink color paper, border none).
- Datos: 6 bajistas — Marta Vilches / Sergio Peña / Noa B. / Kike Román / Alba Serrano / Tomás Varela con zonas y tags respectivos (ver `core.jsx`).

---

### 05 · Perfil de músico → `features/musicians/musician-profile/`

**Propósito:** ver detalle del perfil público.

**Layout (canvas 1280×1500), vertical scroll:**

1. **Header bar** (16×40, borderBottom line): icon back + Wordmark 18 | Meta `['PERFIL PÚBLICO', 'EDITADO HACE 3 DÍAS']`.

2. **Hero** (padding 40×40×0, grid 240px/1fr/180px gap 32):
   - Col 1: `<PhotoPlaceholder 240h tone=plum label="marta vilches">`.
   - Col 2: Meta `['MÚSICA · LAVAPIÉS', 'EN LÍNEA HACE 2H']` → h1 Serif 72 "Marta / Vilches." (Vilches. italic) → 5 Tags (BAJO active, VOZ SECUNDARIA, LV.4 AVANZADO, 3 AÑOS, FINDES + MIÉRCOLES) → párrafo 15 ink2 max 560w bio.
   - Col 3: "compartís" card (bg ink color paper padding 20 center): mono 10 accentSoft "COMPARTÍS" → display 28 "4 influencias / y barrio" → subtítulo 12 color #c9c1b4. Debajo Btn accent lg "Enviar mensaje" con icon chat + Btn ghost md "Guardar" con icon heart (ambos full-width).

3. **Samples** (padding 40, borderBottom ink del header): Serif 30 "Samples" + Meta `['5 PISTAS', 'ACTUALIZADO HACE 1 SEMANA']`.
   - 4 filas 14px pad borderBottom line, grid `40px/1.5fr/2fr/auto` gap 16:
     - Botón circular 32px border ink (active bg ink) con icon play/pause.
     - Título 14 fw 500 + Meta [género].
     - `<Waveform bars=60 height=24 progress>` interpolando si playing.
     - Duración mono 12 muted.
   - Pistas: "Humedad — bajo line (demo) · 2:43 · Post-punk · Original", "Cover — This Charming Man · 3:02 · Indie · The Smiths", "Jam session Wurlitzer · 4:18 · Improvisación · 2025", "Slap study #3 · 1:12 · Funk · Ejercicio".

4. **Grid inferior** (padding 40, grid 1fr 1fr gap 32):
   - Col A: Meta "INFLUENCIAS" → grid 4 col de 8 cards (bg white border line padding 10 text-center 11 ink2): Slowdive, IDLES, Viva Belgrado, La Habitación Roja, Fontaines D.C., Triángulo de Amor Bizarro, La Plata, Carolina Durante. Luego Meta "LOCAL DE ENSAYO" → card 14pad flex gap 12: photo placeholder 60×60 tone ink + Serif 18 "Estudios Bemol" + Meta ["LEGAZPI", "SALA 3", "15€/H"].
   - Col B: Meta "EXPERIENCIA" → 3 filas 80/1fr: mono 10 accent año + título 14 fw 500 + desc 12 muted. Ítems: "2023–24 · Los Santos Vagos · Bajo y coros · 12 bolos · 1 EP grabado" / "2022 · Eléctrica Sur · Banda tributo · 6 meses" / "2020–21 · Escuela Municipal Suzuki · Formación clásica contrabajo". Luego Meta "AMIGOS EN COMÚN" → flex gap 8: Avatar 32 Dani K (amber) / Laura M (green) / Álex R (plum) con nombre 12 al lado.

---

### 06 · Chat → `features/chat/`

**Propósito:** mensajería 1:1.

**Layout (canvas 1440×860):** 3 columnas `[300 lista] [1fr thread] [260 preview perfil]`.

**Col 1 — Lista conversaciones (bg white borderRight line):**
- Header 16×20 borderBottom: Wordmark 18 + mono 10 muted "INBOX · 2".
- Search bar 10×16 borderBottom: icon search 13 + input placeholder "Buscar...".
- Items conversación (grid 40/1fr/auto gap 10, padding 14×16 borderBottom line, active bg paper2): Avatar 40 + nombre 13 fw 500/600 + preview 12 muted elipsis + tiempo mono 9 + badge unread accent pill radius 8.
  - Marta V. (active, 2 unread, plum) "ok, ¿el sábado a las 18?" 2min
  - Los Perros Verdes (ink) "te mandamos la demo adjunta" 1h
  - Sala Siroco (amber) "Reserva confirmada para el 27" 3h
  - Dani K. (green) "mira esta batería, brutal" Ayer
  - Estudios Bemol (blue) "dispone sala 3 de 19 a 22h" 2d
  - Laura M. (plum) "🎹 pasamos el sample?" 4d

**Col 2 — Thread:**
- Header 14×24 borderBottom line: Avatar 38 plum + "Marta Vilches" 14 fw 600 + Meta [BAJO, LAVAPIÉS, EN LÍNEA]. Right: Btn ghost sm "Ver perfil" + Btn primary sm "Proponer ensayo".
- Body flex col overflow auto, padding 24, bg paper:
  - Separator "— HOY · 14:22 —" mono 10 muted centrado.
  - Burbujas: max 420, padding 10×14, font 14 line 1.4, timestamp mono 9 abajo-derecha:
    - them (bg white border line): "Ey Iván! vi tu perfil, me mola mucho lo que propones 👁" 14:22
    - me (bg ink color paper): "Hey Marta! Igualmente, escuché el sample de Humedad, que vicio de bajo" 14:25
    - them: "jaja gracias! cuándo te iría bien vernos? tengo local en Legazpi" 14:26
    - me: "De lujo. El sábado por la tarde?" 14:28
  - **Card propuesta de ensayo** (bg ink color paper padding 14 max 340w): Meta accentSoft "★ PROPUESTA DE ENSAYO" + Serif 20 "Sábado 26 abr · 18:00" + Meta #c9c1b4 "[ESTUDIOS BEMOL, SALA 3, 2H · 30€]" + 2 botones mono 11 UPPERCASE: accent "ACEPTAR" y ghost border #3a332c "PROPONER OTRA".
  - them: "ok, ¿el sábado a las 18?" 14:30.
- Composer 14×20 borderTop, bg white: botón + 32×32 border line2 / input placeholder "Escribe un mensaje..." bg paper border line2 padding 10×12 / botón send accent "ENVIAR" con icon.

**Col 3 — Preview perfil (bg paper2 borderLeft line padding 20):**
- PhotoPlaceholder 140h plum.
- Serif 22 "Marta Vilches" + Meta "BAJO · LV.4" + 3 tags POST-PUNK/SHOEGAZE/FINDES.
- Sección COMPARTÍS (mt 20 pt 16 borderTop line): lista 12 ink2 lineheight 1.6: influencias, zona, disponibilidad, amigos.
- Sección ARCHIVOS: card "humedad-demo.mp3" con icon play accent + duración 2:43.

---

### 07 · Mapa de la escena → `features/map/` (nueva feature, no existe en routes aún)

**Propósito:** descubrimiento visual por ubicación.

**Layout (canvas 1280×820):**

**Header** (16×32 borderBottom line): Wordmark 18 + mono 10 muted "/ MAPA DE LA ESCENA · MADRID" | Meta `['3.241 ACTIVOS', 'ACTUALIZADO HACE 2 MIN']`.

**Body grid 1fr 320px:**

**Mapa (bg paper2, posición relativa):**
- SVG viewBox 100×100 preserveAspectRatio="none" con:
  - Trama de dots 3×3 (line2).
  - 4 paths de calles curvas (line2, stroke 0.3-0.4).
  - 1 path río `#b8c8d4` stroke 1.2 opacity 0.6.
  - 2 elipses verdes para parques (opacity 0.12).
  - Labels mono 1.5 letter-spacing 0.3 color muted: MALASAÑA, LAVAPIÉS, CHAMBERÍ, LA LATINA.
- 9 pins absolute (translate -50% -100%):
  - Etiqueta mono 10 letter-spacing 1 color paper bg `{typeColor}` padding 4×8 border 1px ink (2px si selected) con whitespace nowrap. Active: scale 1.1 + shadow.
  - Triángulo inferior 5px borderLeft/Right transparent, 8px borderTop ink.
  - Colores por tipo: musician=accent, band=plum, venue=ink, event=green, teacher=blue.
  - Pins: Dani K. (musician), **Marta Vilches (musician, selected)**, Los Perros Verdes (band), Estudios Bemol (venue), Jam Indie (event), Carlos Ruiz (teacher), Laura M. (musician), Sala Costello (venue), Open Stage (event).
- Leyenda (absolute bottom-left 20/20, bg white border line2 padding 12×14): "LEYENDA" meta + 6 rows toggle (Todos/Músicos/Bandas/Locales/Eventos/Profes) con swatch 10×10.
- Zoom buttons (absolute top-right 20/20, bg white border line2): + / − vertical stack 32×32.

**Side panel (padding 20, overflow auto):**
- PhotoPlaceholder 140h del pin seleccionado (tone según tipo).
- Meta `[TYPE UPPERCASE, 'MADRID']` → Serif 28 nombre → 13 ink2 sub.
- 2 botones mt 14 flex gap 6: primary sm flex-1 "Ver perfil" + ghost sm "Saludar" con icon chat.
- mt 28 pt 20 borderTop line Meta "CERCA DE ESTE PIN" → 4 items 10pad borderTop line flex gap 10: swatch 6×6 color tipo + nombre 13 + subtitle 11 muted elipsis. Click cambia selected.

---

### 08 · Eventos → `features/events/`

**Propósito:** agenda pública de bolos, jams, open stages.

**Layout (canvas 1280×1080, padding 32×40):**

**Header flex between bottom-aligned:**
- Left: Meta `['AGENDA', 'MADRID', 'ABRIL 2026']` + Serif 72 "Jams, bolos, / open stages." (segunda italic accent).
- Right: 3 botones small: ghost "Esta semana" / ghost "Mes" / primary "Publicar evento" (icon plus).

**Grid 2 columnas gap 16 de cards:**

Cada card: grid 120/1fr, overflow hidden. Default: bg white border line color ink. **Featured** (la primera y la última): bg ink color paper.
- Left panel (padding 20 center flex-col, borderRight): bg paper2 (o accent en featured). Mono 10 day (JUE/SÁB...) / Serif 52 día / mono 10 letter 2 mes / borderTop line + mono 10 hora.
- Right panel (padding 20 flex col between): Serif 24 letter -0.4 lineheight 1.1 título + Meta [lugar, zona, precio] (muted o #c9c1b4 en featured). Footer mt 14 flex between: tags mono 9 (border-line2 o border #3a332c en featured) + Btn primary/accent sm "Apuntarme".

Eventos:
- **★** 23 ABR JUE 22:00 / Jam Night Indie / Wurlitzer Ballroom · Centro · Gratis / INDIE, ABIERTA, 12/20 (featured ink+accent)
- 25 ABR SÁB 21:30 / Open Stage · Singer-Songwriter / Sala El Sol · Centro · 5€ / FOLK, ACÚSTICO, 8/15
- 26 ABR DOM 19:00 / Domingo de Blues / Café Central · Sol · 8€ / BLUES, JAM
- 27 ABR LUN 20:00 / Jazz Night / Bogui Jazz · Chueca · 10€ / JAZZ, 4/10 ABIERTAS
- 30 ABR JUE 19:00 / Ensayo abierto · Hardcore / Nave 73 · Legazpi · Gratis / HARDCORE, ABIERTA
- **★** 02 MAY SÁB 20:00 / Festival BandYou · 1º aniversario / La Riviera · Centro · 15€ / ★ ANIVERSARIO, 8 BANDAS (featured)

---

### 09 · Local de ensayo → `features/rehearsal-spaces/rehearsal-profile/`

**Propósito:** detalle y reserva de sala.

**Layout (canvas 1280×1280):** vertical scroll.

**Header** (16×40 borderBottom line): back + Wordmark 18 | Meta `['LOCAL DE ENSAYO', 'LEGAZPI']`.

**Body grid 1.4fr 1fr gap 40, padding 40:**

**Col izquierda:**
- Galería foto grid 2fr/1fr/1fr gap 4: sala 3 (260h, span 1 col), batería (128h), amps (128h), mesa (128h, span 2 cols). Todas tone=ink placeholders.
- Meta "LOCAL DE ENSAYO · LEGAZPI" → Serif 56 "Estudios Bemol" (Bemol italic).
- 5 tags mt 16: 15€/H active, 5 SALAS, BATERÍA, P.A. INCLUIDO, PARKING.
- Párrafo 15 ink2 lineheight 1.6 max 540w con descripción.
- **Sección disponibilidad** mt 28: Meta "DISPONIBILIDAD · SEMANA 22-28 ABR". Card bg white border line padding 16:
  - Header grid 48/repeat(7,1fr): nombre día mono 9 + fecha Serif 18.
  - 7 filas (horas 10/12/14/16/18/20/22h): mono 10 muted label + 7 celdas 28h border 1px. Estados: `□` libre (bg paper, hover), `■` ocupado (bg line2 cursor not-allowed), `●` tu selección (bg accent color paper "TÚ" mono 9 letter 1).
  - Selección predefinida: sábado 16:00 y 18:00 (TÚ), varios ocupados salpicados, resto libre.
  - Leyenda mt 14: 3 items con swatches 10×10.

**Col derecha:**
- **Reserva card** (bg ink color paper padding 24):
  - Meta accentSoft "RESERVA" → Serif 32 "Sábado 27 abr" + 14 c9c1b4 "Sala 3 · 16:00 – 18:00".
  - Borde sep 1px #3a332c. 3 rows: "2 horas · sala 3 · 30,00 €", "Grabación multipista · —", "Tasas · incluidas".
  - Total Serif 24 "Total · 30,00 €".
  - Btn accent lg full "Reservar ahora".
  - mono 9 muted center "CANCELACIÓN GRATIS HASTA 24H ANTES".
- **Equipamiento** mt 20: Meta + grid 2col gap 6 de 6 cards (padding 10 border line bg white fontSize 12 flex gap 6): icon check accent + "Batería Mapex", "Ampli Ampeg", "Ampli Fender", "P.A. 800W", "4 mics SM58", "Mesa Yamaha".
- **Dueño** mt 20 pt 20 borderTop line: Meta "DUEÑO" + Avatar 44 amber + "Raúl Hernández" 14 fw 500 + Meta `['RESPONDE EN ~20 MIN', '★ 4.9']` + Btn ghost sm "Msg" icon chat.

---

## Interactions & Behavior

### Global
- Navegación principal: sidebar de Home / bottom bar móvil (no diseñado aún para móvil v1).
- Hover en cards: leve elevación (sombra suave) o borde a ink — definir en `styles.css`.
- Keyboard: `⌘K` abre búsqueda global (hint visible en input).
- El logo "band·you" siempre enlaza a `/home` si logged-in, `/` si no.

### Onboarding
- Stepper lineal. Botón atrás permitido pero conserva estado. El paso final cierra el flow y navega a `/home`.
- Validación mínima: rol obligatorio; instrumentos ≥ 1 si rol ∈ {Músico, Banda}; estilos 1-5; nivel 1-5; zona y radio cualquier valor válido.

### Home feed
- Tabs switchean la lista (por ahora solo filtro client-side sobre el mismo array).
- Click en card de músico → `/musicians/:id`.
- Click en "Escribir" → abre conversación en `/chat?to=:id`.
- Card destacado del día es un slot editorial configurable server-side.

### Búsqueda
- Todos los filtros actualizan el resultado en vivo (debounce 200ms).
- Toggle LISTA/MAPA/CARDS intercambia el render, NO la ruta.
- Sort por cercanía (default) / nivel / actividad.

### Perfil de músico
- Play de samples: solo uno a la vez. Progress bar local (en Angular, RxJS interval). Al terminar, vuelve a 0 y pausa.
- "Enviar mensaje" → navega a `/chat` con conversación nueva o existente.
- "Guardar" → toggle wishlist, feedback visual (icono lleno).

### Chat
- Al enviar mensaje: animate entrada (fade + slide up 8px, 150ms).
- "Proponer ensayo" → modal/bottom sheet con date/slot picker que genera una card especial del tipo PROPUESTA. El botón ACEPTAR marca la reserva como confirmada y dispara side-effect (crea entrada en agenda).
- Typing indicator cuando aplicable.

### Mapa
- Click en pin → actualiza side panel + scroll al mismo en móvil.
- Leyenda funciona como filtro (layer toggle).
- Zoom +/− aumenta/reduce escala del SVG (pan con drag, no obligatorio v1).

### Eventos
- "Apuntarme" → toggle RSVP, cambia a "Apuntado" con check.
- "Publicar evento" → modal formulario (otra pantalla, no diseñada aún).

### Sala de ensayo
- Click en celda libre del calendario → selecciona (máx. 4 horas contiguas). Selección actualiza el panel RESERVA en vivo (duración, total).
- Calendario navegable por semanas (fechas, prev/next).

---

## State Management

Sugerido: **Angular signals** por feature + servicios singleton para datos compartidos.

- `AuthService` (ya existe) → `user$`, `isLoggedIn()`.
- `MessagesService` (ya existe) → extender con `conversations$`, `activeThread$`, `sendMessage()`.
- `SupabaseService` (ya existe) → base para todas las llamadas.
- Nuevos servicios: `MusiciansService`, `BandsService`, `VenuesService`, `RehearsalSpacesService`, `TeachersService`, `EventsService`, `SearchService`, `OnboardingService`.
- Señales locales por componente: filtros de búsqueda, step de onboarding, pestaña activa de home, playing track id, etc.

---

## Responsive behavior

Los mocks son **desktop only** (1280–1440 de ancho). Para móvil:
- Sidebars colapsan a bottom nav (4-5 items máximo).
- Grids 3 cols → 1 col con scroll horizontal para bandas.
- Chat 3-col → 1-col con back nav entre lista / thread / perfil.
- Hero landing: stack vertical, vinilo centrado debajo del título a 220px.
- **Pedir al diseñador un pass de móvil** antes de implementar — no inventarlo.

---

## Assets

**No hay imágenes reales.** Todo uso de `<PhotoPlaceholder>` debe reemplazarse cuando existan fotos. Mientras tanto, conservar el look rayado (repeating-linear-gradient 135deg) como fallback oficial — es parte de la identidad visual.

**Sin iconos externos** (no Font Awesome, no Lucide). Usar los 20 SVGs inline del set `Icons` en `shared.jsx`, convertidos a un `<app-icon name="search|chat|...">` en Angular.

**Fuentes:** Google Fonts only (ver sección Tipografía). Bodoni Moda, Instrument Serif, Inter, JetBrains Mono, Oswald.

---

## Implementation Tips

1. **Empezar por los tokens y primitivas.** Añadir colores a `tailwind.config.js` y crear `app-wordmark`, `app-btn`, `app-tag`, `app-meta`, `app-avatar`, `app-vinyl`, `app-photo-placeholder`, `app-icon` antes de tocar ninguna pantalla.

2. **El vinyl es la primitiva firmada del producto.** No simplificar. El gradiente radial + rings + label + hole es la receta. Si se anima (landing hero), respetar 8s linear infinite.

3. **El diseño es cuadrado.** Lucha contra la tentación de poner `rounded-xl`. Solo hay radios donde he marcado.

4. **Mezcla tipográfica italic + regular en H1/H2 es sistema, no adorno.** Respetarla en todos los titulares largos.

5. **Dos capas de acento:** `accent` (ámbar) para CTAs y highlights; los tonos plum/green/blue son solo para variar avatares, vinilos y pins de mapa — nunca para CTAs.

6. **Los textos están en español (España).** Mantener "vosotros", "bolo", "profe", topónimos de Madrid reales (Malasaña, Lavapiés, Legazpi, etc.).

7. **El panel Tweaks del HTML de referencia NO existe en producción.** Es solo para que yo pueda iterar colores — descartar al implementar.

---

## Files

Contenido de este paquete (`design_handoff_bandyou/`):

```
design_handoff_bandyou/
├── README.md                    ← este archivo
└── reference/
    ├── BandYou Platform.html    ← entry del prototipo (Design Canvas con los 9 artboards)
    ├── tokens.js                ← paleta y tipografía en un objeto
    ├── shared.jsx               ← primitivas (Vinyl, Avatar, Btn, Tag, Meta, Stamp, Wordmark, PhotoPlaceholder, Waveform, Icons)
    ├── design-canvas.jsx        ← NO IMPLEMENTAR. Solo es el canvas de presentación.
    └── screens/
        ├── landing.jsx          ← 01 Landing
        ├── onboarding.jsx       ← 02 Onboarding (6 steps)
        ├── home.jsx             ← 03 Home / Feed
        ├── core.jsx             ← 04 Search + 05 MusicianProfile + 06 Chat
        └── extras.jsx           ← 07 MapScene + 08 Events + 09 Rehearsal
```

**Para abrir localmente el prototipo:** `cd design_handoff_bandyou/reference && python3 -m http.server 8000` → abrir `http://localhost:8000/BandYou Platform.html`.

---

## Mapa pantalla ↔ feature Angular

| Pantalla | Ruta sugerida | Componente existente a llenar |
|---|---|---|
| 01 Landing | `/` | `features/landing/landing.component.{html,ts}` |
| 02 Onboarding | `/onboarding` | `features/onboarding/onboarding.component.{html,ts}` |
| 03 Home | `/home` | `features/home/home.component.{html,ts}` |
| 04 Búsqueda | `/search` | `features/search/search.component.{html,ts}` |
| 05 Perfil músico | `/musicians/:id` | `features/musicians/musician-profile/` |
| 06 Chat | `/chat` / `/chat/:id` | `features/chat/chat.component.{html,ts}` |
| 07 Mapa | `/map` | **crear** `features/map/map.component.{html,ts}` |
| 08 Eventos | `/events` | `features/events/` |
| 09 Sala ensayo | `/rehearsal-spaces/:id` | `features/rehearsal-spaces/rehearsal-profile/` |

Además: `features/bands/band-profile`, `features/venues/venue-profile`, `features/teachers/teacher-profile`, `features/inbox`, `features/dashboard`, `features/auth/*` → **aún sin diseño**. Pedir al diseñador antes de implementar o reutilizar el sistema para un primer pase.

---

## Prompt sugerido para arrancar con Claude Code

> Abre este repo (`bandyou/`, Angular 17+ standalone + Tailwind + Supabase). Lee `design_handoff_bandyou/README.md` completo — contiene las specs de 9 pantallas en alta fidelidad.
>
> Empieza por:
> 1. Añadir tokens de color y fuentes a `tailwind.config.js` y `src/styles.css`.
> 2. Crear en `src/app/shared/components/` las primitivas: `wordmark`, `btn`, `tag`, `meta`, `avatar`, `vinyl`, `sleeve`, `stamp`, `photo-placeholder`, `waveform`, `icon`. Usa las implementaciones de referencia en `design_handoff_bandyou/reference/shared.jsx` como guía visual exacta, pero escribe código Angular idiomático.
> 3. Implementa la **Landing** (`features/landing/`) pixel-perfect contra `reference/screens/landing.jsx`.
> 4. Pausa y muéstrame la Landing antes de seguir.

Una vez validada la Landing, continuar en orden: Onboarding → Home → Search → Musician Profile → Chat → Map → Events → Rehearsal.
