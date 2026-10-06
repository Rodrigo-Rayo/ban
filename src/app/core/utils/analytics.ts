/**
 * Vercel Web Analytics: cookieless, aggregated page views (no IP stored, nothing kept
 * on the device). Same as `@vercel/analytics` inject() without the package: the script
 * is served by Vercel from this origin (CSP 'self') and tracks SPA navigations itself.
 * Only in production builds; it does nothing until Analytics is enabled in Vercel.
 */
export const ANALYTICS_SCRIPT = '/_vercel/insights/script.js';

type VaQueue = { va?: (...args: unknown[]) => void; vaq?: unknown[][] };

export function injectAnalytics(doc: Document = document): void {
  if (doc.head.querySelector(`script[src="${ANALYTICS_SCRIPT}"]`)) return;
  const w = (doc.defaultView ?? window) as unknown as VaQueue;
  w.va = w.va || ((...args: unknown[]) => { (w.vaq = w.vaq || []).push(args); });
  const script = doc.createElement('script');
  script.src = ANALYTICS_SCRIPT;
  script.defer = true;
  doc.head.appendChild(script);
}
