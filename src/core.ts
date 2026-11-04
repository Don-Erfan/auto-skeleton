import { collectSkeletonBlocks, sameBlocks, type SkeletonBlock } from './measure';
import { BLOCK_ATTR, CSS, LOADING_ATTR, OVERLAY_ATTR } from './styles';

export type SkeletonAnimation = 'shimmer' | 'pulse' | 'none';

export interface AutoSkeletonOptions {
  /** Skeleton animation. Default `"shimmer"`. */
  animation?: SkeletonAnimation;
  /** Color of the skeleton bars. Default `rgba(128,128,128,.2)` (works on light and dark backgrounds). */
  baseColor?: string;
  /** Color of the moving shine (shimmer only). Default `rgba(255,255,255,.35)`. */
  highlightColor?: string;
  /** Length of one animation cycle, in seconds (number) or any CSS time (string). Default `1.5`. */
  duration?: number | string;
  /** Corner radius of text lines (px when a number). Default `4`. */
  textRadius?: number | string;
  /** Keep the content's backgrounds, borders and shadows (cards, panels, ...) under the skeleton. Default `true`. */
  surfaces?: boolean;
  /** Merge adjacent text fragments on the same line into a single bar. Default `true`. */
  mergeText?: boolean;
  /** Class name added to every text/block element of the skeleton. */
  blockClassName?: string;
  /** Class name added to the overlay element that contains the skeleton. */
  overlayClassName?: string;
}

export interface AutoSkeletonController {
  /** The element the skeleton is attached to. */
  readonly element: HTMLElement;
  /** `true` while the skeleton is shown. */
  readonly active: boolean;
  /** Hide the content and show its skeleton. */
  start(): void;
  /** Remove the skeleton and show the content again. */
  stop(): void;
  /** `start()` when `true`, `stop()` when `false`. */
  setLoading(loading: boolean): void;
  /** Change options; takes effect immediately if the skeleton is shown. */
  update(options: AutoSkeletonOptions): void;
  /** Re-measure right now (changes are normally picked up automatically). */
  refresh(): void;
  /** The blocks currently drawn. */
  getBlocks(): SkeletonBlock[];
  /** `stop()` and release everything; the controller can't be used afterwards. */
  destroy(): void;
}

const CSS_VARS: Array<[keyof AutoSkeletonOptions, string]> = [
  ['baseColor', '--auto-skeleton-base'],
  ['highlightColor', '--auto-skeleton-highlight'],
  ['duration', '--auto-skeleton-duration'],
];

const OVERLAY_STYLE =
  'position:absolute;top:0;left:0;width:0;height:0;margin:0;padding:0;border:0;' +
  'overflow:visible;pointer-events:none;z-index:1;display:block';

function cssLength(value: number | string): string {
  return typeof value === 'number' ? `${value}px` : value;
}

function cssTime(value: number | string): string {
  return typeof value === 'number' ? `${value}s` : value;
}

function setClass(el: Element, className: string | undefined): void {
  if (className) el.setAttribute('class', className);
  else el.removeAttribute('class');
}

function scheduleFrame(callback: () => void): () => void {
  if (typeof requestAnimationFrame === 'function') {
    const id = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(id);
  }
  const id = setTimeout(callback, 16);
  return () => clearTimeout(id);
}

/**
 * Attach an auto-generated skeleton to `element`. Works with any framework (or none).
 *
 * ```ts
 * const skeleton = autoSkeleton(document.querySelector('#card')!);
 * skeleton.start();          // content hidden, skeleton shown
 * await loadData();
 * skeleton.stop();           // real content shown
 * ```
 */
export function autoSkeleton(element: HTMLElement, options: AutoSkeletonOptions = {}): AutoSkeletonController {
  let current: AutoSkeletonOptions = { ...options };
  let active = false;
  let destroyed = false;
  let overlay: HTMLSpanElement | null = null;
  let blockEls: HTMLSpanElement[] = [];
  let blocks: SkeletonBlock[] = [];
  let direction: 'ltr' | 'rtl' = 'ltr';
  let cancelFrame: (() => void) | null = null;
  let cleanups: Array<() => void> = [];
  const inerted = new Set<Element>();
  let previousPosition: string | null = null;
  let previousBusy: string | null = null;

  const doc = element.ownerDocument;
  const view = doc.defaultView;

  const applyOverlayOptions = (): void => {
    if (!overlay) return;
    overlay.setAttribute('data-animation', current.animation || 'shimmer');
    setClass(overlay, current.overlayClassName);
    for (const [key, variable] of CSS_VARS) {
      const value = current[key] as string | number | undefined;
      if (value === undefined || value === null || value === '') overlay.style.removeProperty(variable);
      else overlay.style.setProperty(variable, key === 'duration' ? cssTime(value) : String(value));
    }
  };

  const paintBlock = (el: HTMLSpanElement, block: SkeletonBlock): void => {
    el.setAttribute(BLOCK_ATTR, block.kind);
    setClass(el, block.kind === 'surface' ? undefined : current.blockClassName);
    const s = el.style;
    s.cssText = '';
    s.left = `${block.x}px`;
    s.top = `${block.y}px`;
    s.width = `${block.width}px`;
    s.height = `${block.height}px`;
    if (block.kind === 'text') {
      s.borderRadius = cssLength(current.textRadius === undefined ? 4 : current.textRadius);
    } else if (block.radius) {
      s.borderRadius = block.radius;
    }
    const paint = block.paint;
    if (paint) {
      if (paint.backgroundColor) s.backgroundColor = paint.backgroundColor;
      if (paint.borderTop) s.borderTop = paint.borderTop;
      if (paint.borderRight) s.borderRight = paint.borderRight;
      if (paint.borderBottom) s.borderBottom = paint.borderBottom;
      if (paint.borderLeft) s.borderLeft = paint.borderLeft;
      if (paint.boxShadow) s.boxShadow = paint.boxShadow;
    }
  };

  const render = (): void => {
    if (!overlay) return;
    overlay.setAttribute('data-direction', direction);
    while (blockEls.length > blocks.length) {
      const el = blockEls.pop();
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
    while (blockEls.length < blocks.length) {
      const el = doc.createElement('span');
      overlay.appendChild(el);
      blockEls.push(el);
    }
    blocks.forEach((block, index) => paintBlock(blockEls[index], block));
  };

  // Hidden content must not be focusable or announced by screen readers.
  const applyInert = (): void => {
    for (let child = element.firstElementChild; child; child = child.nextElementSibling) {
      if (child === overlay || inerted.has(child) || child.hasAttribute('inert')) continue;
      child.setAttribute('inert', '');
      inerted.add(child);
    }
  };

  const measure = (): void => {
    cancelFrame = null;
    if (!active || !overlay) return;
    applyInert();
    const next = collectSkeletonBlocks(element, {
      exclude: overlay,
      mergeText: current.mergeText,
      surfaces: current.surfaces,
    });
    const nextDirection = view && view.getComputedStyle(element).direction === 'rtl' ? 'rtl' : 'ltr';
    if (nextDirection === direction && sameBlocks(blocks, next)) return;
    blocks = next;
    direction = nextDirection;
    render();
  };

  const schedule = (): void => {
    if (active && !cancelFrame) cancelFrame = scheduleFrame(measure);
  };

  const observe = (): void => {
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    const observeSizes = (): void => {
      if (!resizeObserver) return;
      resizeObserver.disconnect();
      resizeObserver.observe(element);
      for (let child = element.firstElementChild; child; child = child.nextElementSibling) {
        if (child !== overlay) resizeObserver.observe(child);
      }
    };
    observeSizes();
    if (resizeObserver) cleanups.push(() => resizeObserver.disconnect());

    if (typeof MutationObserver === 'function') {
      const mutationObserver = new MutationObserver((records) => {
        let relevant = false;
        let childrenChanged = false;
        for (const record of records) {
          // Ignore our own drawing and our own bookkeeping.
          if (overlay && (record.target === overlay || overlay.contains(record.target))) continue;
          if (record.type === 'attributes' && record.attributeName === 'inert') continue;
          relevant = true;
          if (record.type === 'childList' && record.target === element) childrenChanged = true;
        }
        if (childrenChanged) observeSizes();
        if (relevant) schedule();
      });
      mutationObserver.observe(element, { subtree: true, childList: true, characterData: true, attributes: true });
      cleanups.push(() => mutationObserver.disconnect());
    }

    // Images, videos and fonts can change the layout after they load.
    element.addEventListener('load', schedule, true);
    element.addEventListener('error', schedule, true);
    cleanups.push(() => {
      element.removeEventListener('load', schedule, true);
      element.removeEventListener('error', schedule, true);
    });

    if (view) {
      view.addEventListener('resize', schedule);
      cleanups.push(() => view.removeEventListener('resize', schedule));
    }

    const fonts = (doc as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts) {
      if (fonts.ready && typeof fonts.ready.then === 'function') fonts.ready.then(schedule, () => undefined);
      if (typeof fonts.addEventListener === 'function') {
        fonts.addEventListener('loadingdone', schedule);
        cleanups.push(() => fonts.removeEventListener('loadingdone', schedule));
      }
    }
  };

  const start = (): void => {
    if (destroyed || active) return;
    active = true;

    // The overlay is absolutely positioned inside the element.
    if (view && view.getComputedStyle(element).position === 'static') {
      previousPosition = element.style.position;
      element.style.position = 'relative';
    }
    previousBusy = element.getAttribute('aria-busy');
    element.setAttribute('aria-busy', 'true');
    element.setAttribute(LOADING_ATTR, 'loading');

    overlay = doc.createElement('span');
    overlay.setAttribute(OVERLAY_ATTR, '');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.cssText = OVERLAY_STYLE;
    const style = doc.createElement('style');
    style.textContent = CSS;
    overlay.appendChild(style);
    element.appendChild(overlay);
    applyOverlayOptions();

    blocks = [];
    blockEls = [];
    direction = 'ltr';
    // Measure synchronously so the next painted frame already shows the skeleton.
    measure();
    observe();
  };

  const stop = (): void => {
    if (!active) return;
    active = false;
    if (cancelFrame) cancelFrame();
    cancelFrame = null;
    cleanups.forEach((cleanup) => cleanup());
    cleanups = [];

    inerted.forEach((el) => el.removeAttribute('inert'));
    inerted.clear();
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
    blockEls = [];
    blocks = [];

    element.removeAttribute(LOADING_ATTR);
    if (previousBusy === null) element.removeAttribute('aria-busy');
    else element.setAttribute('aria-busy', previousBusy);
    if (previousPosition !== null) {
      element.style.position = previousPosition;
      previousPosition = null;
    }
  };

  const update = (next: AutoSkeletonOptions): void => {
    const remeasure = next.mergeText !== current.mergeText || next.surfaces !== current.surfaces;
    current = { ...current, ...next };
    if (!active) return;
    applyOverlayOptions();
    if (remeasure) {
      blocks = [];
      measure();
    } else {
      render();
    }
  };

  return {
    element,
    get active() {
      return active;
    },
    start,
    stop,
    setLoading: (loading: boolean) => (loading ? start() : stop()),
    update,
    refresh: () => {
      if (cancelFrame) cancelFrame();
      measure();
    },
    getBlocks: () => blocks.slice(),
    destroy: () => {
      stop();
      destroyed = true;
    },
  };
}
