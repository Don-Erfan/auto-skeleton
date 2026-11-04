import * as React from 'react';
import { ATTR_OVERLAY, collectSkeletonBlocks, sameBlocks, type SkeletonBlock } from './measure';
import { BLOCK_ATTR, CSS, LOADING_ATTR } from './styles';

export type SkeletonAnimation = 'shimmer' | 'pulse' | 'none';

export interface AutoSkeletonProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /** While `true`, the children are hidden and a skeleton of them is shown instead. */
  loading: boolean;
  /** The real UI. It is rendered (invisibly) while loading so it can be measured. */
  children?: React.ReactNode;
  /** Element used for the wrapper. Default `"div"`. */
  as?: React.ElementType;
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
  /** Keep the component's backgrounds, borders and shadows (cards, panels, ...) under the skeleton. Default `true`. */
  surfaces?: boolean;
  /** Merge adjacent text fragments on the same line into a single bar. Default `true`. */
  mergeText?: boolean;
  /** Class name added to every text/block element of the skeleton. */
  blockClassName?: string;
  /** Class name added to the overlay element that contains the skeleton. */
  overlayClassName?: string;
}

interface Snapshot {
  blocks: SkeletonBlock[];
  direction: 'ltr' | 'rtl';
}

const EMPTY: Snapshot = { blocks: [], direction: 'ltr' };

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

function toCssLength(value: number | string): string {
  return typeof value === 'number' ? `${value}px` : value;
}

function toCssTime(value: number | string): string {
  return typeof value === 'number' ? `${value}s` : value;
}

function setRef<T>(ref: React.Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as React.MutableRefObject<T | null>).current = value;
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
 * Wrap any component and get a skeleton generated from its real DOM.
 *
 * ```tsx
 * <AutoSkeleton loading={isLoading}>
 *   <UserProfileCard user={data ?? placeholderUser} />
 * </AutoSkeleton>
 * ```
 */
export const AutoSkeleton = React.forwardRef<HTMLElement, AutoSkeletonProps>(function AutoSkeleton(props, forwardedRef) {
  const {
    loading,
    children,
    as: Component = 'div',
    animation = 'shimmer',
    baseColor,
    highlightColor,
    duration,
    textRadius = 4,
    surfaces = true,
    mergeText = true,
    blockClassName,
    overlayClassName,
    style,
    ...rest
  } = props;

  const rootRef = React.useRef<HTMLElement | null>(null);
  const overlayRef = React.useRef<HTMLSpanElement | null>(null);
  const [snapshot, setSnapshot] = React.useState<Snapshot>(EMPTY);

  const handleRootRef = React.useCallback(
    (node: HTMLElement | null) => {
      rootRef.current = node;
      setRef(forwardedRef, node);
    },
    [forwardedRef],
  );

  useIsomorphicLayoutEffect(() => {
    if (!loading) return undefined;
    const root = rootRef.current;
    if (!root) return undefined;

    let disposed = false;
    let cancelFrame: (() => void) | null = null;
    const inerted = new Set<Element>();
    const view = root.ownerDocument.defaultView;

    // Hidden content must not be focusable or announced by screen readers.
    const applyInert = (): void => {
      for (let child = root.firstElementChild; child; child = child.nextElementSibling) {
        if (child === overlayRef.current || inerted.has(child) || child.hasAttribute('inert')) continue;
        child.setAttribute('inert', '');
        inerted.add(child);
      }
    };

    const measure = (): void => {
      cancelFrame = null;
      if (disposed) return;
      applyInert();
      const blocks = collectSkeletonBlocks(root, { exclude: overlayRef.current, mergeText, surfaces });
      const direction = view && view.getComputedStyle(root).direction === 'rtl' ? 'rtl' : 'ltr';
      setSnapshot((prev) =>
        prev.direction === direction && sameBlocks(prev.blocks, blocks) ? prev : { blocks, direction },
      );
    };

    const schedule = (): void => {
      if (!disposed && !cancelFrame) cancelFrame = scheduleFrame(measure);
    };

    // Measure synchronously so the first painted frame already shows the skeleton.
    measure();

    const cleanups: Array<() => void> = [];

    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    const observeSizes = (): void => {
      if (!resizeObserver) return;
      resizeObserver.disconnect();
      resizeObserver.observe(root);
      for (let child = root.firstElementChild; child; child = child.nextElementSibling) {
        if (child !== overlayRef.current) resizeObserver.observe(child);
      }
    };
    observeSizes();
    if (resizeObserver) cleanups.push(() => resizeObserver.disconnect());

    if (typeof MutationObserver === 'function') {
      const mutationObserver = new MutationObserver((records) => {
        const overlay = overlayRef.current;
        let relevant = false;
        let childrenChanged = false;
        for (const record of records) {
          // Ignore our own rendering and our own `inert` bookkeeping.
          if (overlay && (record.target === overlay || overlay.contains(record.target))) continue;
          if (record.type === 'attributes' && record.attributeName === 'inert') continue;
          relevant = true;
          if (record.type === 'childList' && record.target === root) childrenChanged = true;
        }
        if (childrenChanged) observeSizes();
        if (relevant) schedule();
      });
      mutationObserver.observe(root, { subtree: true, childList: true, characterData: true, attributes: true });
      cleanups.push(() => mutationObserver.disconnect());
    }

    // Images, videos and fonts can change the layout after they load.
    root.addEventListener('load', schedule, true);
    root.addEventListener('error', schedule, true);
    cleanups.push(() => {
      root.removeEventListener('load', schedule, true);
      root.removeEventListener('error', schedule, true);
    });

    if (view) {
      view.addEventListener('resize', schedule);
      cleanups.push(() => view.removeEventListener('resize', schedule));
    }

    const fonts = (root.ownerDocument as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts) {
      if (fonts.ready && typeof fonts.ready.then === 'function') fonts.ready.then(schedule, () => undefined);
      if (typeof fonts.addEventListener === 'function') {
        fonts.addEventListener('loadingdone', schedule);
        cleanups.push(() => fonts.removeEventListener('loadingdone', schedule));
      }
    }

    return () => {
      disposed = true;
      if (cancelFrame) cancelFrame();
      cleanups.forEach((cleanup) => cleanup());
      inerted.forEach((el) => el.removeAttribute('inert'));
      inerted.clear();
    };
  }, [loading, mergeText, surfaces]);

  const rootStyle: React.CSSProperties = { position: 'relative', ...style };
  if (loading) rootStyle.color = 'transparent';

  const cssVars: Record<string, string> = {};
  if (baseColor) cssVars['--auto-skeleton-base'] = baseColor;
  if (highlightColor) cssVars['--auto-skeleton-highlight'] = highlightColor;
  if (duration !== undefined) cssVars['--auto-skeleton-duration'] = toCssTime(duration);

  const textBorderRadius = toCssLength(textRadius);

  const overlay = loading ? (
    <span
      ref={overlayRef}
      {...{ [ATTR_OVERLAY]: '' }}
      data-animation={animation}
      data-direction={snapshot.direction}
      aria-hidden="true"
      className={overlayClassName}
      style={
        {
          position: 'absolute',
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          overflow: 'visible',
          pointerEvents: 'none',
          zIndex: 1,
          display: 'block',
          ...cssVars,
        } as React.CSSProperties
      }
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {snapshot.blocks.map((block, index) => {
        const blockStyle: React.CSSProperties = {
          left: block.x,
          top: block.y,
          width: block.width,
          height: block.height,
        };
        if (block.kind === 'text') {
          blockStyle.borderRadius = textBorderRadius;
        } else if (block.radius) {
          blockStyle.borderRadius = block.radius;
        }
        if (block.paint) {
          const paint = block.paint;
          if (paint.backgroundColor) blockStyle.backgroundColor = paint.backgroundColor;
          if (paint.borderTop) blockStyle.borderTop = paint.borderTop;
          if (paint.borderRight) blockStyle.borderRight = paint.borderRight;
          if (paint.borderBottom) blockStyle.borderBottom = paint.borderBottom;
          if (paint.borderLeft) blockStyle.borderLeft = paint.borderLeft;
          if (paint.boxShadow) blockStyle.boxShadow = paint.boxShadow;
          // Surfaces may cast shadows outside their box.
          blockStyle.overflow = 'visible';
        }
        return (
          <span
            key={index}
            {...{ [BLOCK_ATTR]: block.kind }}
            className={block.kind === 'surface' ? undefined : blockClassName}
            style={blockStyle}
          />
        );
      })}
    </span>
  ) : null;

  return (
    <Component
      {...rest}
      ref={handleRootRef}
      {...{ [LOADING_ATTR]: loading ? 'loading' : undefined }}
      aria-busy={loading ? true : rest['aria-busy']}
      style={rootStyle}
    >
      {children}
      {overlay}
    </Component>
  );
});

AutoSkeleton.displayName = 'AutoSkeleton';
