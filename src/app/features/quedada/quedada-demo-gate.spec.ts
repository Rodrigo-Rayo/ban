import { readDemo } from './quedada.service';

describe('quedada demo gate', () => {
  it('never turns on outside dev mode, whatever the URL says', () => {
    expect(readDemo('?demo=ganador', false)).toBeNull();
  });

  it('turns on in dev mode for the known phases only', () => {
    expect(readDemo('?demo=ganador', true)).toBe('ganador');
    expect(readDemo('?demo=hackeo', true)).toBeNull();
    expect(readDemo('', true)).toBeNull();
  });
});
