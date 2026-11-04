# @don-erfan/auto-skeleton

**Zero-config skeleton loaders generated from your real DOM.** Point it at any element and get a shimmer skeleton with the same size, the same shapes and the same layout. You don't write a separate `<Skeleton />` component, and nothing drifts out of sync when the design changes.

The core is **framework-free TypeScript** (vanilla, Vue, Svelte, Angular, …), and a ready-made **React** component is included.

[![npm](https://img.shields.io/npm/v/@don-erfan/auto-skeleton.svg)](https://www.npmjs.com/package/@don-erfan/auto-skeleton)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@don-erfan/auto-skeleton)](https://bundlephobia.com/package/@don-erfan/auto-skeleton)
[![license](https://img.shields.io/npm/l/@don-erfan/auto-skeleton.svg)](./LICENSE)

![A profile card and the skeleton auto-skeleton generates for it](https://cdn.jsdelivr.net/npm/@don-erfan/auto-skeleton@1.0.0/docs/preview.png)

```tsx
// React: no separate skeleton component needed!
<AutoSkeleton loading={isLoading}>
  <UserProfileCard user={data ?? placeholderUser} />
</AutoSkeleton>
```

```ts
// Any framework, or none
const skeleton = autoSkeleton(document.querySelector('#card')!);
skeleton.start(); // …load data…
skeleton.stop();
```

- **Pixel-accurate.** Every text line, image, icon, button and input is measured from the real layout.
- **Keeps your design.** Card backgrounds, borders, shadows and rounded corners stay, so the skeleton looks like *your* component.
- **Always in sync.** It re-measures on resize, content changes, image loads and font loads.
- **RTL ready.** Right-to-left text (فارسی, العربية, עברית) is measured line by line, and the shimmer runs right to left.
- **Accessible.** Uses `aria-busy`, makes hidden content `inert` (not focusable, not announced), and turns the animation off for `prefers-reduced-motion`.
- **SSR / Next.js App Router ready.** The React entry ships with `"use client"`, needs no CSS import, and is safe to render on the server.
- **Tiny, with zero dependencies.** About 4 kB min+gzip. Written in TypeScript and ships ESM + CJS with full type definitions. React (16.14 – 19) is an *optional* peer dependency, needed only for the React entry.

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

| Import | What you get | Needs React |
| --- | --- | --- |
| `@don-erfan/auto-skeleton` | `autoSkeleton()` (framework-free core) and `collectSkeletonBlocks()` | no |
| `@don-erfan/auto-skeleton/react` | the `<AutoSkeleton>` component | yes |

## React

```tsx
import { AutoSkeleton } from '@don-erfan/auto-skeleton/react';

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

`AutoSkeleton` renders a wrapper element (a `div` by default, with `position: relative`) and accepts every normal HTML attribute (`className`, `style`, `id`, `data-*`, `aria-*` and so on). It forwards its `ref` to that element. Besides `loading`, `children` and `as` (the wrapper element, for example `'section'` or `'li'`), it takes all the [options](#options) as props.

## Vanilla TypeScript / any framework

```ts
import { autoSkeleton } from '@don-erfan/auto-skeleton';

const card = document.querySelector<HTMLElement>('#profile-card')!;
const skeleton = autoSkeleton(card, { animation: 'shimmer' });

skeleton.start();                 // content hidden, skeleton shown
const user = await fetchUser();
renderUser(card, user);           // update the DOM however you like
skeleton.stop();                  // real content shown
```

`autoSkeleton(element, options?)` returns a controller:

| Member | Description |
| --- | --- |
| `start()` | Hide the element's content and show its skeleton. |
| `stop()` | Remove the skeleton and show the content again. |
| `setLoading(loading)` | `start()` when `true`, `stop()` when `false`. |
| `update(options)` | Change [options](#options); applied immediately. |
| `refresh()` | Re-measure now. Changes are normally picked up automatically. |
| `getBlocks()` | The blocks currently drawn. |
| `destroy()` | Stop and release everything. |
| `active` | `true` while the skeleton is shown. |
| `element` | The element the skeleton is attached to. |

The skeleton is drawn inside the element, so the element needs to be a containing block. If its `position` is `static`, it is set to `relative` while the skeleton is shown and restored afterwards.

<details>
<summary><b>Vue 3</b></summary>

```vue
<!-- Skeleton.vue -->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { autoSkeleton, type AutoSkeletonController } from '@don-erfan/auto-skeleton';

const props = defineProps<{ loading: boolean }>();
const el = ref<HTMLElement>();
let skeleton: AutoSkeletonController | undefined;

onMounted(() => {
  skeleton = autoSkeleton(el.value!);
  skeleton.setLoading(props.loading);
});
watch(() => props.loading, (loading) => skeleton?.setLoading(loading));
onBeforeUnmount(() => skeleton?.destroy());
</script>

<template>
  <div ref="el"><slot /></div>
</template>
```

```vue
<Skeleton :loading="isLoading"><UserProfileCard :user="user ?? placeholderUser" /></Skeleton>
```

</details>

<details>
<summary><b>Svelte</b></summary>

```ts
// skeleton.ts
import { autoSkeleton } from '@don-erfan/auto-skeleton';

export function skeleton(node: HTMLElement, loading: boolean) {
  const controller = autoSkeleton(node);
  controller.setLoading(loading);
  return {
    update: (next: boolean) => controller.setLoading(next),
    destroy: () => controller.destroy(),
  };
}
```

```svelte
<div use:skeleton={loading}><UserProfileCard user={user ?? placeholderUser} /></div>
```

</details>

## Give it placeholder data

The skeleton is built from what is actually rendered. An empty `<h2></h2>` has no size, so it has nothing to draw. While loading, render placeholder data with roughly realistic lengths, as in `data ?? placeholderUser` above, and the skeleton will look like the real thing. A list works the same way: render a few placeholder items while loading.

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

```html
<div data-skeleton>…</div>          <!-- draw this whole element as ONE block -->
<div data-skeleton-ignore>…</div>   <!-- leave this element out of the skeleton -->
```

## Options

The React component takes these as props; the core takes them as `autoSkeleton(element, options)` / `update(options)`.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `animation` | `'shimmer' \| 'pulse' \| 'none'` | `'shimmer'` | Animation style. |
| `baseColor` | `string` | `rgba(128,128,128,.2)` | Color of the bars and blocks. |
| `highlightColor` | `string` | `rgba(255,255,255,.35)` | Color of the moving shine (shimmer only). |
| `duration` | `number \| string` | `1.5` | Length of one animation cycle (seconds as a number, or any CSS time such as `'800ms'`). |
| `textRadius` | `number \| string` | `4` | Corner radius of text bars (px when a number). |
| `surfaces` | `boolean` | `true` | Keep the backgrounds, borders and shadows of containers. Set `false` to draw only bars and blocks. |
| `mergeText` | `boolean` | `true` | Merge adjacent inline text fragments on the same line into one bar. |
| `blockClassName` | `string` | — | Class added to every bar and block (not to surfaces). |
| `overlayClassName` | `string` | — | Class added to the overlay element. |

## Theming

The defaults are semi-transparent, so they work on light and dark backgrounds alike. You can theme with options or, globally, with CSS variables:

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

- **Layout is untouched.** The skeleton is an absolutely positioned overlay, and the hidden content keeps its layout, so nothing jumps when loading ends. Flex and grid wrappers lay out their children as usual.
- **Table rows / list items.** In React, use `as` to keep valid HTML, for example `<AutoSkeleton as="li" …>`. The wrapper can't be a `tbody`/`tr`; wrap the whole `<table>` instead.
- **Next.js App Router.** `@don-erfan/auto-skeleton/react` is already marked `"use client"`, so you can import it straight into a Server Component file.
- **Server rendering.** On the server, the content is rendered hidden. The skeleton is measured on the client before the first paint.

## Low-level API

The measuring function is exported too, in case you want to draw skeletons yourself (for example, on a canvas):

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

ساخت خودکار اسکلتون از روی DOM واقعی. هسته‌ی پکیج TypeScript خالصه و به هیچ فریم‌ورکی وابسته نیست (Vanilla، Vue، Svelte، Angular و…)، و یه کامپوننت آماده‌ی React هم داره. موقع لودینگ، محتوای اصلی (با دیتای placeholder) به‌صورت مخفی رندر می‌شه، ابعاد و استایل متن‌ها، عکس‌ها و دکمه‌ها از روی DOM خونده می‌شه و یه لایه‌ی Shimmer دقیقاً هم‌سایز و هم‌شکل روش کشیده می‌شه. دیگه لازم نیست برای هر کامپوننت یه `<Skeleton />` جدا بسازی، و اگه طرح عوض بشه اسکلتون هم خودش به‌روز می‌شه. از راست‌به‌چپ (RTL) هم کامل پشتیبانی می‌کنه.

```tsx
// React
import { AutoSkeleton } from '@don-erfan/auto-skeleton/react';

<AutoSkeleton loading={isLoading}>
  <UserProfileCard user={data ?? placeholderUser} />
</AutoSkeleton>
```

```ts
// TypeScript خالص / هر فریم‌ورکی
import { autoSkeleton } from '@don-erfan/auto-skeleton';

const skeleton = autoSkeleton(document.querySelector('#card')!);
skeleton.start();
skeleton.stop();
```

## License

[MIT](./LICENSE)
