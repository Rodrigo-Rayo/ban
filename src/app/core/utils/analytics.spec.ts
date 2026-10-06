import { ANALYTICS_SCRIPT, injectAnalytics } from './analytics';

describe('injectAnalytics', () => {
  let doc: Document;
  beforeEach(() => { doc = document.implementation.createHTMLDocument('t'); });

  it('adds the same-origin Vercel script once', () => {
    injectAnalytics(doc);
    injectAnalytics(doc);
    const scripts = doc.head.querySelectorAll(`script[src="${ANALYTICS_SCRIPT}"]`);
    expect(scripts.length).toBe(1);
    expect((scripts[0] as HTMLScriptElement).defer).toBeTrue();
  });
});
