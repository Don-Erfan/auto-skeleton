/**
 * The stylesheet is rendered inline (inside the overlay) instead of being
 * injected into <head>, so it works with SSR/streaming, shadow roots and
 * iframes, and needs no CSS import from the consumer.
 */
export const LOADING_ATTR = 'data-auto-skeleton';
export const BLOCK_ATTR = 'data-auto-skeleton-block';

export const CSS = [
  // Hide the real content while keeping its layout (it is what gets measured).
  `[${LOADING_ATTR}="loading"]>:not([data-auto-skeleton-overlay]){opacity:0!important;pointer-events:none!important;user-select:none!important}`,
  `@keyframes auto-skeleton-shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`,
  `@keyframes auto-skeleton-pulse{0%,100%{opacity:1}50%{opacity:.4}}`,
  `[${BLOCK_ATTR}]{position:absolute;display:block;box-sizing:border-box;overflow:hidden;margin:0;padding:0;pointer-events:none}`,
  `[${BLOCK_ATTR}="text"],[${BLOCK_ATTR}="block"]{background-color:var(--auto-skeleton-base,rgba(128,128,128,.2))}`,
  `[data-auto-skeleton-overlay][data-animation="pulse"] [${BLOCK_ATTR}="text"],[data-auto-skeleton-overlay][data-animation="pulse"] [${BLOCK_ATTR}="block"]{animation:auto-skeleton-pulse var(--auto-skeleton-duration,1.5s) ease-in-out infinite}`,
  `[data-auto-skeleton-overlay][data-animation="shimmer"] [${BLOCK_ATTR}="text"]::after,[data-auto-skeleton-overlay][data-animation="shimmer"] [${BLOCK_ATTR}="block"]::after{content:"";position:absolute;top:0;left:0;right:0;bottom:0;transform:translateX(-100%);background-image:linear-gradient(90deg,transparent,var(--auto-skeleton-highlight,rgba(255,255,255,.35)),transparent);animation:auto-skeleton-shimmer var(--auto-skeleton-duration,1.5s) ease-in-out infinite}`,
  // In right-to-left layouts the shine travels from right to left.
  `[data-auto-skeleton-overlay][data-direction="rtl"] [${BLOCK_ATTR}]::after{animation-direction:reverse}`,
  `@media (prefers-reduced-motion:reduce){[${BLOCK_ATTR}],[${BLOCK_ATTR}]::after{animation:none!important}}`,
].join('\n');
