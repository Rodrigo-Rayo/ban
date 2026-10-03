import { computed, signal } from '@angular/core';

/**
 * Only ONE bottom notice is visible at a time. Priority: cookies -> notification
 * permission -> install. Each banner reports whether it *wants* to show; the
 * lower-priority ones wait until the higher ones are dismissed.
 */
export const bannerWants = {
  cookie: signal(false),
  notif: signal(false),
  install: signal(false),
};

export const showCookieBanner = computed(() => bannerWants.cookie());
export const showNotifBanner = computed(() => bannerWants.notif() && !bannerWants.cookie());
export const showInstallBanner = computed(
  () => bannerWants.install() && !bannerWants.cookie() && !bannerWants.notif(),
);
/** True while any bottom notice is on screen (toasts move up to clear it). */
export const anyBannerVisible = computed(
  () => showCookieBanner() || showNotifBanner() || showInstallBanner(),
);
