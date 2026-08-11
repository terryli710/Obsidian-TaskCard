import esbuild from 'esbuild';
import esbuildSvelte from 'esbuild-svelte';
import sveltePreprocess from 'svelte-preprocess';
import process from 'process';
import { builtinModules } from 'node:module';

// Node's own list, so the build needs no dependency to know what a builtin is.
// Both bare ("fs") and prefixed ("node:fs") spellings must be externalised.
const builtins = [...builtinModules, ...builtinModules.map((m) => `node:${m}`)];

const prod = process.env.NODE_ENV === 'production';

const options = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'main.js',
  // Obsidian plugins run in a browser context. Node built-ins exist only on
  // desktop, and this plugin declares isDesktopOnly: false, so nothing may be
  // bundled from them; builtins stay external so any dev-only module that
  // reaches for one can't drag it into the shipped bundle.
  // `format` must stay 'cjs': Obsidian loads main.js as a CommonJS module.
  platform: 'browser',
  format: 'cjs',
  target: 'es2018',
  plugins: [
    esbuildSvelte({
      compilerOptions: { css: true },
      preprocess: sveltePreprocess()
    })
  ],
  define: {
    'process.env.NODE_ENV': `"${process.env.NODE_ENV}"`
  },
  external: [
    'obsidian',
    'electron',
    '@codemirror/view',
    '@codemirror/state',
    ...builtins
  ],
  minify: prod,
  sourcemap: prod ? false : 'inline',
  logLevel: 'info'
};

(async () => {
  const context = await esbuild.context(options);

  if (prod) {
    await context.rebuild();
    process.exit(0);
  } else {
    await context.watch();
  }
})().catch(() => process.exit(1));
