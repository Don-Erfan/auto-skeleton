import { defineConfig, type Options } from 'tsup';

const shared: Options = {
  format: ['esm', 'cjs'],
  target: 'es2018',
  dts: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  external: ['react'],
};

export default defineConfig([
  // Framework-free core: no React, no directives.
  { ...shared, entry: { index: 'src/index.ts' } },
  // React adapter. "use client" marks it as a client component for React Server Components (Next.js App Router).
  { ...shared, entry: { react: 'src/react.tsx' }, banner: { js: '"use client";' } },
]);
