# Authenticated E2E suite

Logged-in flows with two real users: messaging (realtime), content (post, event, gear with photo, vacancy,
application, favorites, avatar) and session (logout/login, wrong password).

**These specs write to whatever Supabase project the app under test points at.** Everything they create is
tagged `E2E <timestamp>` and removed through the UI (post, event, listing, favorite; vacancies are closed
because the app has no vacancy delete). Leftovers that cannot be removed from the UI: the avatar upload,
the application row, and notifications/messages between the two test accounts. Use dedicated accounts.

## Accounts

Create two users in Supabase: Authentication -> Users -> Add user -> Create new user, tick **Auto Confirm User**.

| User | Role | Device in tests | Onboarding |
|------|------|-----------------|------------|
| A | Musician | Desktop Chrome | Sign in once manually and finish onboarding as a **musician** |
| B | Band | iPhone 13 | Sign in once manually and finish onboarding as a **band** |

Both must reach `/home` after logging in (onboarding complete). B's band profile is discovered
automatically from B's dashboard ("Ver perfil").

## Environment variables

```
E2E_USER_A_EMAIL  E2E_USER_A_PASSWORD  E2E_USER_B_EMAIL  E2E_USER_B_PASSWORD
```

If any is missing, the `setup` and `authenticated` projects report every test as skipped with the message
`Authenticated E2E skipped: set <missing vars> ...`. The public `chromium` project never runs these files.

## Running

```bash
# PowerShell
$env:E2E_USER_A_EMAIL="..."; $env:E2E_USER_A_PASSWORD="..."
$env:E2E_USER_B_EMAIL="..."; $env:E2E_USER_B_PASSWORD="..."
npx playwright test --project=authenticated     # runs the setup project first (dependency)

# bash
E2E_USER_A_EMAIL=... E2E_USER_A_PASSWORD=... E2E_USER_B_EMAIL=... E2E_USER_B_PASSWORD=... \
  npx playwright test --project=authenticated
```

- Against a local dev server (`npm start`, port 4200) the app talks to the Supabase project in
  `src/environments/environment.ts`.
- Against the production build: `npx ng build`, then
  `npx playwright test --config playwright.prod.config.ts --project=authenticated`.
- Workers are forced to 1 when the credentials are set (the specs share two accounts).
- Sessions are stored in `e2e/.auth/` (git-ignored). Delete the folder to force fresh logins.
