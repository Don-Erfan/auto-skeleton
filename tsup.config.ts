import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  target: 'es2018',
  dts: true,
  sourcemap: true,
  clean: true,
  minify: false,
  splitting: false,
  external: ['react'],
  // Next.js App Router / React Server Components: this is a client component.
  banner: { js: '"use client";' },
});
