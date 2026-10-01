# Checklist de lanzamiento — acciones en paneles

Cosas que no se pueden hacer desde el código. Ordenadas por urgencia.

## 1. Supabase — base de datos (URGENTE: fuga de emails activa)

- [ ] SQL Editor → New query → pegar `supabase/audit_2026_09_security_fixes.sql` → Run.
      Escrito contra las políticas reales del 2026-10-01. Todo en una transacción.
- [ ] Verificar (sin sesión): `GET /rest/v1/profiles?select=id` con la anon key devuelve `[]`.
- [ ] Después, ejecutar `supabase/audit_2026_10_messaging.sql` (límite de 2000 caracteres por mensaje y
      vista previa de conversación mantenida por la base de datos).
- [ ] Desplegar la función push actualizada: `supabase functions deploy send-push`
      (no se fía del texto del cliente, anti-spam). El cliente es compatible con la versión antigua mientras tanto.

## 2. Supabase — Authentication

- [ ] Authentication → Policies/Settings → **Minimum password length: 8** (hoy 6; el frontend ya exige 8).
- [ ] Authentication → Attack Protection → activar **CAPTCHA** (Turnstile o hCaptcha) para registro y recuperación.
      Requiere añadir el widget en el frontend (pendiente si se activa).
- [ ] Authentication → Email Templates → pegar las plantillas de `supabase/email-templates/`:
      - Change Email Address → `change-email.html` — asunto: `Confirma tu nuevo email en BandYou`
      - Magic Link → `magic-link.html` — asunto: `Tu enlace de acceso a BandYou`
      - Invite user → `invite.html` — asunto: `Te han invitado a BandYou`
      - Reauthentication → `reauthentication.html` — asunto: `Tu código de verificación de BandYou`
      (Confirm signup y Reset password ya están al día.)
- [ ] URL Configuration → **Site URL**: `https://bandyou.es` (hoy apunta a `/auth/callback`).
      Redirect URLs: mantener `https://bandyou.es/auth/callback`; quitar `http://localhost:4200/auth/callback`
      si no se desarrolla contra producción.

## 3. Vercel

- [ ] Domains → marcar **bandyou.es** como dominio principal (hoy redirige a www; canonical y sitemap usan apex).
- [ ] Tras desplegar, comprobar: `curl -I https://bandyou.es/` → 200 con cabecera `content-security-policy`,
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
- [ ] Comprobar que existen y se leen `legal@bandyou.es` y `privacidad@bandyou.es` (punto de contacto DSA).
- [ ] Aceptar los DPA de Supabase y Vercel (Settings → Legal / Data Processing Addendum).
- [ ] Revisión de los textos legales por un abogado antes del lanzamiento.

## 6. Al terminar la auditoría

- [ ] Revocar el token de acceso de Supabase `claude-code-audit` (Account → Access Tokens).
- [ ] Revocar el token antiguo `cli_Rodrigo@DESKTOP-...` si no se usa la CLI.
