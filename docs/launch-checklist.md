# Checklist de lanzamiento — acciones en paneles

Cosas que no se pueden hacer desde el código. Ordenadas por urgencia.

Estado 2026-10-01: desplegado en producción (master). Lighthouse en vivo: rendimiento 82–92,
accesibilidad, buenas prácticas y SEO 100. E2E en vivo 48/48. Cuentas de prueba borradas.

## 1. Supabase — base de datos (aplicado y verificado 2026-10-01)

- [x] SQL Editor → New query → pegar `supabase/audit_2026_09_security_fixes.sql` → Run. (aplicado 2026-10-01)
      Escrito contra las políticas reales del 2026-10-01. Todo en una transacción.
- [x] Verificar (sin sesión): `GET /rest/v1/profiles?select=id` con la anon key devuelve `[]`.
- [x] Después, ejecutar `supabase/audit_2026_10_messaging.sql` (límite de 2000 caracteres por mensaje y
      vista previa de conversación mantenida por la base de datos).
- [x] Ejecutar `supabase/audit_2026_10_bookings_overlap.sql` (impide reservas solapadas entre usuarios distintos). (aplicado 2026-10-01)
- [x] `supabase/audit_2026_10_conversations_fix.sql` aplicado (recursión en la política de conversaciones).
- [x] Desplegar la función push actualizada: `supabase functions deploy send-push` (desplegada 2026-10-01, CORS www incluido)
      (no se fía del texto del cliente, anti-spam). El cliente es compatible con la versión antigua mientras tanto.

## 2. Supabase — Authentication

- [x] Authentication → Policies/Settings → **Minimum password length: 8** (hoy 6; el frontend ya exige 8). (aplicado)
- [ ] Authentication → Attack Protection → activar **CAPTCHA** (Turnstile o hCaptcha) para registro y recuperación.
      Requiere añadir el widget en el frontend (pendiente si se activa).
- [x] Authentication → Email Templates → pegar las plantillas de `supabase/email-templates/`: (aplicado vía API)
      - Change Email Address → `change-email.html` — asunto: `Confirma tu nuevo email en BandYou`
      - Magic Link → `magic-link.html` — asunto: `Tu enlace de acceso a BandYou`
      - Invite user → `invite.html` — asunto: `Te han invitado a BandYou`
      - Reauthentication → `reauthentication.html` — asunto: `Tu código de verificación de BandYou`
      (Confirm signup y Reset password ya están al día.)
- [x] URL Configuration → **Site URL**: `https://bandyou.es` (hoy apunta a `/auth/callback`). (aplicado; allow list incluye www y localhost)
      Redirect URLs: mantener `https://bandyou.es/auth/callback`; quitar `http://localhost:4200/auth/callback`
      si no se desarrolla contra producción.

## 3. Vercel

- [ ] Domains → marcar **bandyou.es** como dominio principal (hoy redirige a www; canonical y sitemap usan apex).
- [x] Tras desplegar, comprobar: `curl -I https://bandyou.es/` → 200 con cabecera `content-security-policy`,
      y `https://bandyou.es/sitemap.xml` → XML con perfiles.

## 4. Correo (DNS en DonDominio)

- [x] Resend: DKIM (`resend._domainkey`) y SPF en `send.bandyou.es` correctos.
- [ ] SPF raíz `bandyou.es`: añadir `~all` al final (`v=spf1 include:spf.dondominio.com ~all`).
- [ ] DMARC: tras 2–4 semanas sin incidencias, pasar de `p=none` a `p=quarantine` y añadir `rua=mailto:...` para informes.

## 5. Contenido y legal

- [ ] Revisar y ejecutar `supabase/prelaunch_cleanup.sql`: 20 cuentas `@bandyou.test` y 36 perfiles/eventos
      de semilla sin dueño. Las previsualizaciones van primero; los DELETE están comentados.
- [ ] Borrar a mano anuncios/posts de prueba de cuentas reales (p. ej. "Cheetos").
- [ ] Rellenar `src/app/features/legal/legal-info.ts`: titular, NIF, domicilio, registro, retención de backups.
- [x] Buzón de contacto: `contacto@bandyou.es` (legal, privacidad y punto de contacto DSA).
- [ ] Aceptar los DPA de Supabase y Vercel (Settings → Legal / Data Processing Addendum).
- [ ] Revisión de los textos legales por un abogado antes del lanzamiento.

## 6. Al terminar la auditoría

- [ ] Revocar el token de acceso de Supabase `claude-code-audit` (Account → Access Tokens).
- [ ] Revocar el token antiguo `cli_Rodrigo@DESKTOP-...` si no se usa la CLI.
