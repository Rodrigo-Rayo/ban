import { errorRef, isChunkLoadError, isForeignError } from './global-error.handler';

describe('isChunkLoadError', () => {
  it('recognises lazy-chunk failures from every browser', () => {
    expect(isChunkLoadError('Failed to fetch dynamically imported module: https://x/chunk-AB.js')).toBeTrue();
    expect(isChunkLoadError('error loading dynamically imported module')).toBeTrue();
    expect(isChunkLoadError('Importing a module script failed.')).toBeTrue();
    expect(isChunkLoadError('ChunkLoadError: Loading chunk 3 failed')).toBeTrue();
  });
  it('ignores other errors', () => {
    expect(isChunkLoadError('Cannot read properties of undefined')).toBeFalse();
  });
});

describe('isForeignError', () => {
  it('spots errors from extensions and injected browser scripts', () => {
    const e = new TypeError('x is null');
    e.stack = 'TypeError: x is null\n    at chrome-extension://abcdef/content.js:1:2';
    expect(isForeignError(e)).toBeTrue();
    const ios = new Error('boom');
    ios.stack = 'Error: boom\n at __gCrWeb.autofill.extractForms';
    expect(isForeignError(ios)).toBeTrue();
  });
  it("keeps the app's own errors", () => {
    const e = new Error('boom');
    e.stack = 'Error: boom\n    at https://www.bandyou.es/chunk-AB.js:1:2';
    expect(isForeignError(e)).toBeFalse();
  });
});

describe('errorRef', () => {
  it('gives a short one-line reference', () => {
    expect(errorRef(new TypeError('Cannot read\n properties of null'))).toBe('TypeError: Cannot read properties of null');
    expect(errorRef('x'.repeat(200)).length).toBe(80);
    expect(errorRef({})).toBe('');
  });
});
