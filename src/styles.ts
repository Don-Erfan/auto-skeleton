/**
 * The stylesheet is placed inside each overlay instead of being injected into
 * <head>, so it also works inside shadow roots and iframes, and the consumer
 * never has to import a CSS file.
 */
export const LOADING_ATTR = 'data-auto-skeleton';
export const BLOCK_ATTR = 'data-auto-skeleton-block';
export const OVERLAY_ATTR = 'data-auto-skeleton-overlay';
/** Set by server-rendered markup until the client takes over (React adapter). */
export const SSR_ATTR = 'data-auto-skeleton-ssr';

const LOADING = `[${LOADING_ATTR}="loading"]`;
const SHIMMER = `[${OVERLAY_ATTR}][data-animation="shimmer"]`;
const PULSE = `[${OVERLAY_ATTR}][data-animation="pulse"]`;
const BARS = (scope: string, suffix = ''): string =>
  `${scope} [${BLOCK_ATTR}="text"]${suffix},${scope} [${BLOCK_ATTR}="block"]${suffix}`;

export const CSS = [
  // Hide the real content while keeping its layout (it is what gets measured).
  // `color` also hides text nodes placed directly inside the root.
  `${LOADING}{color:transparent!important}`,
  `${LOADING}>:not([${OVERLAY_ATTR}]){opacity:0!important;pointer-events:none!important;user-select:none!important}`,
  `@keyframes auto-skeleton-shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`,
  `@keyframes auto-skeleton-pulse{0%,100%{opacity:1}50%{opacity:.4}}`,
  `[${BLOCK_ATTR}]{position:absolute;display:block;box-sizing:border-box;overflow:hidden;margin:0;padding:0;pointer-events:none}`,
  `[${BLOCK_ATTR}="surface"]{overflow:visible}`,
  `[${BLOCK_ATTR}="text"],[${BLOCK_ATTR}="block"]{background-color:var(--auto-skeleton-base,rgba(128,128,128,.2))}`,
  `${BARS(PULSE)}{animation:auto-skeleton-pulse var(--auto-skeleton-duration,1.5s) ease-in-out infinite}`,
  `${BARS(SHIMMER, '::after')}{content:"";position:absolute;top:0;left:0;right:0;bottom:0;transform:translateX(-100%);background-image:linear-gradient(90deg,transparent,var(--auto-skeleton-highlight,rgba(255,255,255,.35)),transparent);animation:auto-skeleton-shimmer var(--auto-skeleton-duration,1.5s) ease-in-out infinite}`,
  // In right-to-left layouts the shine travels from right to left.
  `[${OVERLAY_ATTR}][data-direction="rtl"] [${BLOCK_ATTR}]::after{animation-direction:reverse}`,
  `@media (prefers-reduced-motion:reduce){[${BLOCK_ATTR}],[${BLOCK_ATTR}]::after{animation:none!important}}`,
].join('\n');

/** Hides server-rendered content until the client measures it (React adapter only). */
export const SSR_CSS =
  `[${SSR_ATTR}]{color:transparent!important}` +
  `[${SSR_ATTR}]>:not(style){opacity:0!important;pointer-events:none!important}`;
