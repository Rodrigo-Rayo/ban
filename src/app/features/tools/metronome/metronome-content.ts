import { Faq, TOOLS_SHARED, toolJsonLd } from '../tools-seo';
import data from './metronome-seo.json';

/**
 * All visible SEO copy (and the JSON-LD built from it) comes from metronome-seo.json, which
 * scripts/prerender-tools.mjs also writes into the static /metronomo HTML.
 */
export interface MetronomeSeo {
  appName: string;
  path: string;
  breadcrumb: string;
  title: string;
  description: string;
  appDescription: string;
  h1: string;
  lead: string;
  tipsTitle: string;
  tips: { title: string; text: string }[];
  tempoTitle: string;
  tempoNote: string;
  tempoTable: { name: string; range: string; feel: string }[];
  faqTitle: string;
  faqs: Faq[];
}

export const METRONOME_SEO: MetronomeSeo = data;
export const PRACTICE_TIPS = METRONOME_SEO.tips;
export const FAQS = METRONOME_SEO.faqs;
export const METRONOME_URL = `${TOOLS_SHARED.siteUrl}${METRONOME_SEO.path}`;

export function metronomeJsonLd(): object {
  return toolJsonLd({
    appName: METRONOME_SEO.appName,
    path: METRONOME_SEO.path,
    description: METRONOME_SEO.appDescription,
    faqs: METRONOME_SEO.faqs,
    crumbs: [{ name: METRONOME_SEO.breadcrumb, path: METRONOME_SEO.path }],
  });
}
