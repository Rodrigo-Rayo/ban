/**
 * Instrument landing pages under /afinador/<slug>. Kept free of imports so app.routes.ts can use
 * it without pulling the tuner into the main bundle; a spec checks it matches tuner-seo.json.
 */
export const TUNER_SLUGS: readonly string[] = ['guitarra', 'bajo', 'ukelele'];

export function isTunerSlug(slug: string | undefined): boolean {
  return slug !== undefined && TUNER_SLUGS.includes(slug);
}
