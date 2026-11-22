import { Faq, TOOLS_SHARED, toolJsonLd } from '../tools-seo';
import data from './tuner-seo.json';
import { TunerMode } from './tunings';

export interface TuningRow {
  id: TunerMode;
  instrument: string;
  notesEs: string;
  notesEn: string;
}

/** One indexable tuner URL: /afinador or an instrument landing page. */
export interface TunerPage {
  slug: string;
  path: string;
  /** Mode preselected on this page (null = the user's saved mode). */
  mode: TunerMode | null;
  breadcrumb: string;
  linkLabel: string;
  title: string;
  description: string;
  h1: string;
  lead: string;
  intro: string;
  tableOrder: TunerMode[];
  howTo: { title: string; steps: string[] };
  faqs: Faq[];
}

export interface TunerSeo {
  appName: string;
  tuningsTitle: string;
  tuningsNote: string;
  tunings: TuningRow[];
  instrumentLinksTitle: string;
  faqTitle: string;
  pages: TunerPage[];
}

export const TUNER_SEO = data as TunerSeo;
export const TUNER_MAIN_PAGE: TunerPage = TUNER_SEO.pages.find(p => p.slug === '')!;

/** Page for a route slug ('' or undefined = /afinador). Null for an unknown slug. */
export function tunerPageFor(slug: string | null | undefined): TunerPage | null {
  return TUNER_SEO.pages.find(p => p.slug === (slug ?? '')) ?? null;
}

/** The tunings table for a page: its own instruments first, then the rest. */
export function tuningRowsFor(page: TunerPage): TuningRow[] {
  const first = page.tableOrder.map(id => TUNER_SEO.tunings.find(t => t.id === id)!).filter(Boolean);
  return [...first, ...TUNER_SEO.tunings.filter(t => !page.tableOrder.includes(t.id))];
}

export function tunerUrl(page: TunerPage): string {
  return `${TOOLS_SHARED.siteUrl}${page.path}`;
}

export function tunerJsonLd(page: TunerPage): object {
  const crumbs = page.slug
    ? [{ name: TUNER_MAIN_PAGE.breadcrumb, path: TUNER_MAIN_PAGE.path }, { name: page.breadcrumb, path: page.path }]
    : [{ name: page.breadcrumb, path: page.path }];
  return toolJsonLd({ appName: TUNER_SEO.appName, path: page.path, description: page.description, faqs: page.faqs, crumbs });
}
