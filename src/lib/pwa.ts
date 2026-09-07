/**
 * Register the service worker, and expose whether the app is installed.
 *
 * Registration is deliberately deferred until after `load`: the worker is not
 * needed to paint the first screen, and racing it against the app's own startup
 * costs the one moment users actually judge.
 */

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // A failed registration costs installability, not the app. Nothing here
      // is worth surfacing to a member.
    });
  });
}

/**
 * Already running from the home screen?
 *
 * Two checks because the platforms disagree: everyone standard supports the
 * display-mode media query, and iOS Safari answers `navigator.standalone`
 * instead. Getting this wrong means nagging someone who already installed it.
 */
export function isInstalled(): boolean {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || iosStandalone;
}

/** iOS gives sites no install prompt, so it needs instructions instead. */
export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
