# Changelog

## 1.0.0

- Framework-free TypeScript core: `autoSkeleton(element, options)` returns a controller
  (`start`, `stop`, `setLoading`, `update`, `refresh`, `getBlocks`, `destroy`) that hides the
  element's content and draws a shimmer skeleton measured from its real DOM: text lines, media,
  form controls, painted boxes and container surfaces.
- React adapter at `@don-erfan/auto-skeleton/react`: `<AutoSkeleton loading>` (React 16.14 – 19,
  SSR safe, `"use client"`). React is an optional peer dependency.
- shimmer / pulse / none animations, theming via options or CSS variables, RTL support,
  `inert` + `aria-busy` accessibility, `prefers-reduced-motion`, automatic re-measuring.
- `collectSkeletonBlocks(element)` low-level measuring API.
