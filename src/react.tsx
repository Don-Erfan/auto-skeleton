import * as React from 'react';
import { autoSkeleton, type AutoSkeletonController, type AutoSkeletonOptions } from './core';
import { SSR_ATTR, SSR_CSS } from './styles';

export type { AutoSkeletonOptions, SkeletonAnimation } from './core';

export interface AutoSkeletonProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'children'>,
    AutoSkeletonOptions {
  /** While `true`, the children are hidden and a skeleton of them is shown instead. */
  loading: boolean;
  /** The real UI. It is rendered (invisibly) while loading so it can be measured. */
  children?: React.ReactNode;
  /** Element used for the wrapper. Default `"div"`. */
  as?: React.ElementType;
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

function setRef<T>(ref: React.Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as React.MutableRefObject<T | null>).current = value;
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
    animation,
    baseColor,
    highlightColor,
    duration,
    textRadius,
    surfaces,
    mergeText,
    blockClassName,
    overlayClassName,
    style,
    ...rest
  } = props;

  const options: AutoSkeletonOptions = {
    animation,
    baseColor,
    highlightColor,
    duration,
    textRadius,
    surfaces,
    mergeText,
    blockClassName,
    overlayClassName,
  };
  const optionsRef = React.useRef(options);
  optionsRef.current = options;

  const rootRef = React.useRef<HTMLElement | null>(null);
  const controllerRef = React.useRef<AutoSkeletonController | null>(null);
  // Until the client has taken over, server-rendered content is hidden by plain CSS.
  const [mounted, setMounted] = React.useState(false);

  const handleRootRef = React.useCallback(
    (node: HTMLElement | null) => {
      rootRef.current = node;
      setRef(forwardedRef, node);
    },
    [forwardedRef],
  );

  // One controller per wrapper element; the DOM work is done by the framework-free core.
  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const controller = autoSkeleton(root, optionsRef.current);
    controllerRef.current = controller;
    setMounted(true);
    return () => {
      controller.destroy();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [Component]);

  useIsomorphicLayoutEffect(() => {
    if (controllerRef.current) controllerRef.current.update(optionsRef.current);
  }, [animation, baseColor, highlightColor, duration, textRadius, surfaces, mergeText, blockClassName, overlayClassName]);

  useIsomorphicLayoutEffect(() => {
    if (controllerRef.current) controllerRef.current.setLoading(loading);
  }, [loading, Component]);

  const hideUntilMounted = loading && !mounted;

  return (
    <Component
      {...rest}
      {...(hideUntilMounted ? { [SSR_ATTR]: '' } : null)}
      ref={handleRootRef}
      style={{ position: 'relative', ...style }}
    >
      {children}
      {hideUntilMounted ? <style dangerouslySetInnerHTML={{ __html: SSR_CSS }} /> : null}
    </Component>
  );
});

AutoSkeleton.displayName = 'AutoSkeleton';

export default AutoSkeleton;
