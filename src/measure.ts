/**
 * DOM measurement: walks a rendered subtree and turns its visible pieces
 * (text lines, images, icons, form controls, decorative boxes) into
 * skeleton blocks positioned relative to the root element.
 */

export type SkeletonBlockKind = 'text' | 'block' | 'surface';

/** Paint copied from a container so the skeleton keeps the component's chrome. */
export interface SurfacePaint {
  backgroundColor: string;
  borderTop: string;
  borderRight: string;
  borderBottom: string;
  borderLeft: string;
  boxShadow: string;
}

export interface SkeletonBlock {
  /**
   * - `text`: one line of text
   * - `block`: media, form controls, buttons, icons and empty painted boxes
   * - `surface`: a container's own background/border/shadow (drawn under the rest)
   */
  kind: SkeletonBlockKind;
  /** Left offset in px, relative to the root's padding box. */
  x: number;
  /** Top offset in px, relative to the root's padding box. */
  y: number;
  width: number;
  height: number;
  /** Computed `border-radius` of the source element (empty for text). */
  radius: string;
  /** Only for `surface` blocks. */
  paint?: SurfacePaint;
}

export interface CollectOptions {
  /** Subtree to ignore entirely (e.g. the overlay that draws the skeleton). */
  exclude?: Element | null;
  /** Merge text fragments that sit next to each other on the same line. Default `true`. */
  mergeText?: boolean;
  /** Collect containers' backgrounds, borders and shadows as `surface` blocks. Default `true`. */
  surfaces?: boolean;
}

/** Attribute that turns an element into a single skeleton block. */
export const ATTR_BLOCK = 'data-skeleton';
/** Attribute that removes an element (and its subtree) from the skeleton. */
export const ATTR_IGNORE = 'data-skeleton-ignore';
/** Attribute placed on every overlay this library renders. */
export const ATTR_OVERLAY = 'data-auto-skeleton-overlay';

const SKIP_TAGS = new Set([
  'script',
  'style',
  'template',
  'noscript',
  'head',
  'meta',
  'link',
  'title',
  'br',
  'wbr',
]);

/** Elements drawn as one solid block; their insides are never inspected. */
const LEAF_TAGS = new Set([
  'img',
  'svg',
  'video',
  'audio',
  'canvas',
  'picture',
  'iframe',
  'object',
  'embed',
  'input',
  'textarea',
  'select',
  'button',
  'progress',
  'meter',
  'hr',
  'math',
]);

const CLIPPING_OVERFLOW = new Set(['hidden', 'clip', 'auto', 'scroll', 'overlay']);

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function toBox(rect: { left: number; top: number; right: number; bottom: number }): Box {
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
}

function intersect(a: Box, b: Box | null): Box {
  if (!b) return a;
  return {
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  };
}

/** True when a computed CSS color is fully transparent. */
export function isTransparentColor(color: string | null | undefined): boolean {
  if (!color) return true;
  const value = color.trim().toLowerCase();
  if (value === 'transparent' || value === '') return true;
  const match = /^(?:rgba?|hsla?)\(([^)]*)\)$/.exec(value);
  if (!match) return false;
  const parts = match[1].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 4) return false;
  const alphaRaw = parts[3];
  const alpha = alphaRaw.endsWith('%') ? parseFloat(alphaRaw) / 100 : parseFloat(alphaRaw);
  return alpha === 0;
}

function borderSide(style: CSSStyleDeclaration, side: string): string {
  const width = parseFloat(style.getPropertyValue(`border-${side}-width`)) || 0;
  const kind = style.getPropertyValue(`border-${side}-style`);
  const color = style.getPropertyValue(`border-${side}-color`);
  if (width <= 0 || !kind || kind === 'none' || kind === 'hidden' || isTransparentColor(color)) {
    return '';
  }
  return `${width}px ${kind} ${color}`;
}

/** Background color, borders and shadow of a container, or `null` if it paints none of them. */
function surfacePaint(style: CSSStyleDeclaration): SurfacePaint | null {
  const backgroundColor = isTransparentColor(style.backgroundColor) ? '' : style.backgroundColor;
  const shadow = style.boxShadow && style.boxShadow !== 'none' ? style.boxShadow : '';
  const paint: SurfacePaint = {
    backgroundColor,
    borderTop: borderSide(style, 'top'),
    borderRight: borderSide(style, 'right'),
    borderBottom: borderSide(style, 'bottom'),
    borderLeft: borderSide(style, 'left'),
    boxShadow: shadow,
  };
  const paints =
    paint.backgroundColor ||
    paint.borderTop ||
    paint.borderRight ||
    paint.borderBottom ||
    paint.borderLeft ||
    paint.boxShadow;
  return paints ? paint : null;
}

/** Does the element paint something by itself (background or border)? */
function paintsBox(style: CSSStyleDeclaration): boolean {
  const image = style.backgroundImage;
  if (image && image !== 'none') return true;
  if (!isTransparentColor(style.backgroundColor)) return true;
  return ['top', 'right', 'bottom', 'left'].some((side) => borderSide(style, side) !== '');
}

/** Does the element contain any element or non-whitespace text? */
function hasContent(el: Element): boolean {
  for (let node = el.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === 1) return true;
    if (node.nodeType === 3 && node.nodeValue && node.nodeValue.trim()) return true;
  }
  return false;
}

function isVisible(style: CSSStyleDeclaration): boolean {
  return style.visibility !== 'hidden' && style.visibility !== 'collapse';
}

const ZERO_RADIUS = /^(?:\s*0(?:\.0+)?(?:px|%|em|rem)?\s*)+$/;

function radiusOf(style: CSSStyleDeclaration): string {
  let radius = style.borderRadius;
  if (!radius) {
    // Some engines leave the shorthand empty; rebuild it from the longhands.
    radius = [
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomRightRadius,
      style.borderBottomLeftRadius,
    ]
      .map((corner) => corner || '0px')
      .join(' ');
  }
  return ZERO_RADIUS.test(radius) ? '' : radius;
}

function clipsOverflow(style: CSSStyleDeclaration): boolean {
  const values = [style.overflowX, style.overflowY].concat((style.overflow || '').split(/\s+/));
  return values.some((value) => !!value && CLIPPING_OVERFLOW.has(value));
}

const round = (n: number): number => Math.round(n * 100) / 100;

/** Merge text fragments that sit side by side on the same line into one bar. */
function mergeTextBlocks(blocks: SkeletonBlock[]): SkeletonBlock[] {
  const sorted = blocks.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const merged: SkeletonBlock[] = [];
  for (const block of sorted) {
    let target: SkeletonBlock | undefined;
    for (const candidate of merged) {
      const overlap =
        Math.min(candidate.y + candidate.height, block.y + block.height) -
        Math.max(candidate.y, block.y);
      const sameLine = overlap >= Math.min(candidate.height, block.height) * 0.6;
      if (!sameLine) continue;
      const gapTolerance = Math.max(candidate.height, block.height) * 0.6;
      const touches =
        block.x <= candidate.x + candidate.width + gapTolerance &&
        block.x + block.width >= candidate.x - gapTolerance;
      if (touches) {
        target = candidate;
        break;
      }
    }
    if (!target) {
      merged.push({ ...block });
      continue;
    }
    const left = Math.min(target.x, block.x);
    const top = Math.min(target.y, block.y);
    const right = Math.max(target.x + target.width, block.x + block.width);
    const bottom = Math.max(target.y + target.height, block.y + block.height);
    target.x = left;
    target.y = top;
    target.width = right - left;
    target.height = bottom - top;
  }
  return merged;
}

/**
 * Measure the rendered subtree of `root` and return the skeleton blocks that
 * reproduce its shape. Coordinates are relative to the padding box of `root`,
 * so the result can be drawn by absolutely positioned children of `root`.
 *
 * Must run in a browser (it relies on real layout).
 */
export function collectSkeletonBlocks(root: Element, options: CollectOptions = {}): SkeletonBlock[] {
  const doc = root.ownerDocument;
  const win = doc && doc.defaultView;
  if (!win || typeof root.getBoundingClientRect !== 'function') return [];

  const exclude = options.exclude || null;
  const mergeText = options.mergeText !== false;
  const surfaces = options.surfaces !== false;
  const rootRect = root.getBoundingClientRect();
  const rootEl = root as HTMLElement;

  // Account for CSS transforms (e.g. scale) applied to the root or its ancestors.
  const layoutWidth = rootEl.offsetWidth;
  const layoutHeight = rootEl.offsetHeight;
  const scaleX = layoutWidth > 0 && rootRect.width > 0 ? rootRect.width / layoutWidth : 1;
  const scaleY = layoutHeight > 0 && rootRect.height > 0 ? rootRect.height / layoutHeight : 1;

  // Absolutely positioned children of `root` are placed from its padding box and
  // scroll together with its content.
  const originX = rootRect.left + ((root.clientLeft || 0) - (root.scrollLeft || 0)) * scaleX;
  const originY = rootRect.top + ((root.clientTop || 0) - (root.scrollTop || 0)) * scaleY;

  const surfaceBlocks: SkeletonBlock[] = [];
  const textBlocks: SkeletonBlock[] = [];
  const boxBlocks: SkeletonBlock[] = [];
  const range = typeof doc.createRange === 'function' ? doc.createRange() : null;

  const push = (
    list: SkeletonBlock[],
    kind: SkeletonBlockKind,
    rect: Box,
    clip: Box | null,
    radius: string,
    paint?: SurfacePaint,
  ): void => {
    const box = intersect(rect, clip);
    const width = box.right - box.left;
    const height = box.bottom - box.top;
    if (!(width >= 0.5) || !(height >= 0.5)) return;
    list.push({
      kind,
      x: round((box.left - originX) / scaleX),
      y: round((box.top - originY) / scaleY),
      width: round(width / scaleX),
      height: round(height / scaleY),
      radius,
      ...(paint ? { paint } : null),
    });
  };

  const visitText = (node: Text, clip: Box | null): void => {
    if (!range || !node.nodeValue || !node.nodeValue.trim()) return;
    range.selectNodeContents(node);
    if (typeof range.getClientRects !== 'function') return;
    const rects = range.getClientRects();
    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];
      if (rect.width < 1 || rect.height < 1) continue;
      push(textBlocks, 'text', toBox(rect), clip, '');
    }
  };

  const visit = (parent: Node, clip: Box | null, visible: boolean): void => {
    for (let node = parent.firstChild; node; node = node.nextSibling) {
      if (node.nodeType === 3) {
        if (visible) visitText(node as Text, clip);
        continue;
      }
      if (node.nodeType !== 1) continue;

      const el = node as Element;
      if (el === exclude) continue;
      const tag = el.localName ? el.localName.toLowerCase() : '';
      if (SKIP_TAGS.has(tag)) continue;
      if (el.hasAttribute(ATTR_IGNORE) || el.hasAttribute(ATTR_OVERLAY)) continue;

      const style = win.getComputedStyle(el);
      if (style.display === 'none') continue;
      const elVisible = isVisible(style);

      if (el.hasAttribute(ATTR_BLOCK) || LEAF_TAGS.has(tag)) {
        if (elVisible) push(boxBlocks, 'block', toBox(el.getBoundingClientRect()), clip, radiusOf(style));
        continue;
      }

      if (style.display === 'contents') {
        visit(el, clip, elVisible);
        continue;
      }

      // An empty element that paints a background/border: avatar circles,
      // color swatches, dividers, progress bars made of divs, ...
      if (!hasContent(el)) {
        if (elVisible && paintsBox(style)) {
          push(boxBlocks, 'block', toBox(el.getBoundingClientRect()), clip, radiusOf(style));
        }
        continue;
      }

      const clips = clipsOverflow(style);
      const needsRect = clips || (surfaces && elVisible);
      const rect = needsRect ? toBox(el.getBoundingClientRect()) : null;

      if (surfaces && elVisible && rect) {
        const paint = surfacePaint(style);
        if (paint) push(surfaceBlocks, 'surface', rect, clip, radiusOf(style), paint);
      }

      const childClip = clips && rect ? intersect(rect, clip) : clip;
      visit(el, childClip, elVisible);
    }
  };

  const rootStyle = win.getComputedStyle(root);
  visit(root, null, isVisible(rootStyle));

  if (range && typeof range.detach === 'function') range.detach();

  // Surfaces are in document order (parents first) and are drawn underneath.
  return surfaceBlocks.concat(boxBlocks, mergeText ? mergeTextBlocks(textBlocks) : textBlocks);
}

function samePaint(a: SurfacePaint | undefined, b: SurfacePaint | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.backgroundColor === b.backgroundColor &&
    a.borderTop === b.borderTop &&
    a.borderRight === b.borderRight &&
    a.borderBottom === b.borderBottom &&
    a.borderLeft === b.borderLeft &&
    a.boxShadow === b.boxShadow
  );
}

/** Shallow structural comparison, used to avoid needless re-renders. */
export function sameBlocks(a: readonly SkeletonBlock[], b: readonly SkeletonBlock[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const p = a[i];
    const q = b[i];
    if (
      p.kind !== q.kind ||
      p.x !== q.x ||
      p.y !== q.y ||
      p.width !== q.width ||
      p.height !== q.height ||
      p.radius !== q.radius ||
      !samePaint(p.paint, q.paint)
    ) {
      return false;
    }
  }
  return true;
}
