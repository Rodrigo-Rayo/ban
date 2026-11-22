import shared from './tools-seo.json';

/**
 * SEO copy for the tools lives in JSON files (tools-seo.json, tuner/tuner-seo.json,
 * metronome/metronome-seo.json). The components render them and scripts/prerender-tools.mjs
 * writes the same texts into the static HTML, so what crawlers read is what users see.
 * Keep the JSON-LD shape here in sync with jsonLd() in that script (spec-checked).
 */

export interface Faq {
  q: string;
  a: string;
}

export interface LinkItem {
  label: string;
  href: string;
  text?: string;
}

export interface ToolsShared {
  siteName: string;
  siteUrl: string;
  homeLabel: string;
  cta: { title: string; text: string; links: LinkItem[] };
  moreTitle: string;
  moreLinks: LinkItem[];
  tools: LinkItem[];
}

export const TOOLS_SHARED: ToolsShared = shared;

export interface Crumb {
  name: string;
  path: string;
}

export interface ToolLdInput {
  appName: string;
  path: string;
  description: string;
  faqs: readonly Faq[];
  crumbs: readonly Crumb[];
}

/** WebApplication + FAQPage + BreadcrumbList for one tool page. */
export function toolJsonLd({ appName, path, description, faqs, crumbs }: ToolLdInput): object {
  const url = `${TOOLS_SHARED.siteUrl}${path}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: appName,
        url,
        description,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Cualquiera (navegador web)',
        browserRequirements: 'Requiere un navegador moderno',
        inLanguage: 'es-ES',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [{ name: TOOLS_SHARED.homeLabel, path: '/' }, ...crumbs].map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: c.name,
          item: `${TOOLS_SHARED.siteUrl}${c.path}`,
        })),
      },
    ],
  };
}
