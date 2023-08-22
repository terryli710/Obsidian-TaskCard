import esbuild from 'esbuild';
import esbuildSvelte from 'esbuild-svelte';
import sveltePreprocess from 'svelte-preprocess';
import process from 'process';

const prod = process.env.NODE_ENV === 'production';

const options = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'main.js',
  platform: 'node',
  plugins: [
    esbuildSvelte({
      compilerOptions: { css: true },
      preprocess: sveltePreprocess()
    })
  ],
  define: {
    'process.env.NODE_ENV': `"${process.env.NODE_ENV}"`
  },
  external: ['obsidian'],
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
