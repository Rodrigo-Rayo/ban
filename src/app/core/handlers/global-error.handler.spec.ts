import { isChunkLoadError } from './global-error.handler';

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
