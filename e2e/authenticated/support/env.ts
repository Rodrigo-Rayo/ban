import * as path from 'node:path';

const REQUIRED_VARS = [
  'E2E_USER_A_EMAIL',
  'E2E_USER_A_PASSWORD',
  'E2E_USER_B_EMAIL',
  'E2E_USER_B_PASSWORD',
] as const;

const missing = REQUIRED_VARS.filter(name => !process.env[name]);

/** True when all four E2E account variables are present. */
export const HAS_E2E_ACCOUNTS = missing.length === 0;

export const SKIP_MESSAGE =
  `Authenticated E2E skipped: set ${missing.join(', ')} (see e2e/authenticated/README.md).`;

export const AUTH_DIR = path.join(__dirname, '..', '..', '.auth');
export const STATE_A = path.join(AUTH_DIR, 'user-a.json');
export const STATE_B = path.join(AUTH_DIR, 'user-b.json');
/** Band profile of user B discovered by the setup project. */
export const BAND_INFO = path.join(AUTH_DIR, 'band.json');

export interface BandInfo {
  path: string;
  name: string;
}

export const credentials = {
  a: { email: process.env['E2E_USER_A_EMAIL'] ?? '', password: process.env['E2E_USER_A_PASSWORD'] ?? '' },
  b: { email: process.env['E2E_USER_B_EMAIL'] ?? '', password: process.env['E2E_USER_B_PASSWORD'] ?? '' },
};
