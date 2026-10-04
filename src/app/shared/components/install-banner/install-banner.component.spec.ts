import { isIosInstallCandidate } from './install-banner.component';

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_MODE = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const IPHONE_INSTAGRAM = IPHONE_SAFARI + ' Instagram 300.0.0';

describe('isIosInstallCandidate', () => {
  it('targets iPhone Safari that is not installed yet', () => {
    expect(isIosInstallCandidate(IPHONE_SAFARI, 5, false)).toBeTrue();
  });

  it('recognises iPads that report a desktop user agent', () => {
    expect(isIosInstallCandidate(IPAD_DESKTOP_MODE, 5, false)).toBeTrue();
    expect(isIosInstallCandidate(IPAD_DESKTOP_MODE, 0, false)).toBeFalse(); // a real Mac
  });

  it('skips installed apps, Android and in-app browsers', () => {
    expect(isIosInstallCandidate(IPHONE_SAFARI, 5, true)).toBeFalse();
    expect(isIosInstallCandidate(ANDROID_CHROME, 5, false)).toBeFalse();
    expect(isIosInstallCandidate(IPHONE_INSTAGRAM, 5, false)).toBeFalse();
  });
});
