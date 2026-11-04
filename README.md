# @don-erfan/auto-skeleton

**Zero-config skeleton loaders for React.** Wrap any component and get a shimmer skeleton generated from its *real* DOM: the same size, the same shapes, the same layout. You don't write a separate `<Skeleton />` component, and nothing drifts out of sync when the design changes.

[![npm](https://img.shields.io/npm/v/@don-erfan/auto-skeleton.svg)](https://www.npmjs.com/package/@don-erfan/auto-skeleton)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@don-erfan/auto-skeleton)](https://bundlephobia.com/package/@don-erfan/auto-skeleton)
[![license](https://img.shields.io/npm/l/@don-erfan/auto-skeleton.svg)](./LICENSE)

![A profile card and the skeleton auto-skeleton generates for it](https://cdn.jsdelivr.net/npm/@don-erfan/auto-skeleton@1.0.0/docs/preview.png)

```tsx
// No separate skeleton component needed!
<AutoSkeleton loading={isLoading}>
  <UserProfileCard user={data ?? placeholderUser} />
</AutoSkeleton>
```

- **Pixel-accurate.** Every text line, image, icon, button and input is measured from the real layout.
- **Keeps your design.** Card backgrounds, borders, shadows and rounded corners stay, so the skeleton looks like *your* component.
- **Always in sync.** It re-measures on resize, content changes, image loads and font loads.
- **RTL ready.** Right-to-left text (فارسی, العربية, עברית) is measured line by line, and the shimmer runs right to left.
- **Accessible.** Uses `aria-busy`, makes hidden content `inert` (not focusable, not announced), and turns the animation off for `prefers-reduced-motion`.
- **SSR / Next.js App Router ready.** Ships with `"use client"`, needs no CSS import, and is safe to render on the server.
- **Tiny (~4 kB min+gzip), with zero dependencies.** React is the only peer dependency (16.14+, 17, 18, 19). Written in TypeScript and ships ESM + CJS.

## Install

```bash
npm install @don-erfan/auto-skeleton
```

```bash
yarn add @don-erfan/auto-skeleton
```

```bash
pnpm add @don-erfan/auto-skeleton
```

## Usage

```tsx
import { AutoSkeleton } from '@don-erfan/auto-skeleton';

const placeholderUser = {
  name: 'Loading name',
  bio: 'A short placeholder bio that is about as long as a real one.',
  avatarUrl: '',
};

function Profile() {
  const { data, isLoading } = useUser();

  return (
    <AutoSkeleton loading={isLoading}>
      <UserProfileCard user={data ?? placeholderUser} />
    </AutoSkeleton>
  );
}
```

While `loading` is `true`, your component is rendered **invisibly**. Its layout is read from the DOM, and a shimmer layer with exactly the same geometry is drawn on top. When `loading` turns `false`, the overlay goes away and the real content appears. Your component is **not remounted**, so its state is kept.

### Give it placeholder data

The skeleton is built from what your component actually renders. An empty `<h2>{user?.name}</h2>` has no size, so it has nothing to draw. Pass placeholder data with roughly realistic lengths, as in `data ?? placeholderUser` above, and the skeleton will look like the real thing. A list works the same way: render a few placeholder items while loading.

```tsx
<AutoSkeleton loading={isLoading}>
  <ProductList products={data ?? Array.from({ length: 4 }, (_, i) => ({ id: i, title: 'Product title', price: '$00.00' }))} />
</AutoSkeleton>
```

## How the skeleton is built

| Your DOM | Skeleton |
| --- | --- |
| Text | One rounded bar **per rendered line**. Adjacent inline fragments such as `Hello <b>world</b>` are merged. |
| `img`, `svg`, `video`, `canvas`, `picture`, `iframe` | One block with the element's own `border-radius`, so round avatars stay round. |
| `button`, `input`, `textarea`, `select`, `progress`, `meter`, `hr` | One block with the element's shape. |
| Empty element with a background or border (avatar `div`, color dot) | One block. |
| Container with a background, border or shadow (card, panel, chip) | Kept as a **surface** underneath, with its real color, border, radius and shadow. |
| `display: none`, `visibility: hidden` | Skipped. |
| Content clipped by `overflow: hidden` | Clipped the same way. |

### Fine-tuning with data attributes

```tsx
<div data-skeleton>…</div>          // draw this whole element as ONE block
<div data-skeleton-ignore>…</div>   // leave this element out of the skeleton
```

## Props

`AutoSkeleton` renders a wrapper element (a `div` by default) and accepts every normal HTML attribute (`className`, `style`, `id`, `data-*`, `aria-*` and so on). It forwards its `ref` to that element.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | — | **Required.** Shows the skeleton while `true`. |
| `children` | `ReactNode` | — | The real UI. |
| `animation` | `'shimmer' \| 'pulse' \| 'none'` | `'shimmer'` | Animation style. |
| `baseColor` | `string` | `rgba(128,128,128,.2)` | Color of the bars and blocks. |
| `highlightColor` | `string` | `rgba(255,255,255,.35)` | Color of the moving shine (shimmer only). |
| `duration` | `number \| string` | `1.5` | Length of one animation cycle (seconds as a number, or any CSS time such as `'800ms'`). |
| `textRadius` | `number \| string` | `4` | Corner radius of text bars (px when a number). |
| `surfaces` | `boolean` | `true` | Keep the backgrounds, borders and shadows of containers. Set `false` to draw only bars and blocks. |
| `mergeText` | `boolean` | `true` | Merge adjacent inline text fragments on the same line into one bar. |
| `as` | `ElementType` | `'div'` | Element used for the wrapper (for example `'section'` or `'li'`). |
| `blockClassName` | `string` | — | Class added to every bar and block (not to surfaces). |
| `overlayClassName` | `string` | — | Class added to the overlay element. |

## Theming

The defaults are semi-transparent, so they work on light and dark backgrounds alike. You can theme with props or, globally, with CSS variables:

```css
:root {
  --auto-skeleton-base: #e7e9ee;
  --auto-skeleton-highlight: rgba(255, 255, 255, 0.6);
  --auto-skeleton-duration: 1.2s;
}

@media (prefers-color-scheme: dark) {
  :root {
    --auto-skeleton-base: #2a2d34;
    --auto-skeleton-highlight: rgba(255, 255, 255, 0.08);
  }
}
```

The generated elements are easy to target from your own CSS:

```css
[data-auto-skeleton-block='text'] { /* text bars */ }
[data-auto-skeleton-block='block'] { /* media, controls */ }
[data-auto-skeleton-block='surface'] { /* kept containers */ }
```

## Notes

- **Wrapper element.** The wrapper is `position: relative` (the overlay is positioned inside it) and otherwise has no styles. If you style it as a flex or grid container, the children are laid out as usual.
- **Table rows / list items.** Use `as` to keep valid HTML, for example `<AutoSkeleton as="li" …>`. The wrapper can't be a `tbody`/`tr`; wrap the whole `<table>` instead.
- **Next.js App Router.** The package is already marked `"use client"`, so you can import it straight into a Server Component file.
- **Server rendering.** On the server, the content is rendered hidden. The skeleton is measured on the client before the first paint.

## Low-level API

The measuring function is exported too, in case you want to draw skeletons yourself (for example, outside React):

```ts
import { collectSkeletonBlocks } from '@don-erfan/auto-skeleton';

const blocks = collectSkeletonBlocks(element);
// [{ kind: 'text' | 'block' | 'surface', x, y, width, height, radius, paint? }, …]
// x/y are relative to the element's padding box.
```

## Browser support

All evergreen browsers (Chrome, Edge, Firefox, Safari 14+). `ResizeObserver` and `MutationObserver` are used when available.

## Development

```bash
npm install
npm run typecheck   # TypeScript
npm test            # unit tests (Vitest + jsdom)
npm run build       # ESM + CJS + .d.ts into dist/
npm run test:e2e    # real-browser layout checks (needs Playwright + Chromium)
```

---

## فارسی

ساخت خودکار اسکلتون از روی DOM واقعی. کامپوننت خودت رو داخل `AutoSkeleton` بذار؛ موقع لودینگ، کامپوننت اصلی (با دیتای placeholder) به‌صورت مخفی رندر می‌شه، ابعاد و استایل متن‌ها، عکس‌ها و دکمه‌ها از روی DOM خونده می‌شه و یه لایه‌ی Shimmer دقیقاً هم‌سایز و هم‌شکل کامپوننت روش کشیده می‌شه. دیگه لازم نیست برای هر کامپوننت یه `<Skeleton />` جدا بسازی، و اگه طرح عوض بشه اسکلتون هم خودش به‌روز می‌شه. از راست‌به‌چپ (RTL) هم کامل پشتیبانی می‌کنه.

```tsx
<AutoSkeleton loading={isLoading}>
  <UserProfileCard user={data ?? placeholderUser} />
</AutoSkeleton>
```

## License

[MIT](./LICENSE)
