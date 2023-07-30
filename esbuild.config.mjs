
import esbuild from "esbuild";
import esbuildSvelte from "esbuild-svelte";
import sveltePreprocess from "svelte-preprocess";

esbuild
.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "main.js",
  plugins: [
    esbuildSvelte({
      compilerOptions: { css: true },
      preprocess: sveltePreprocess(),
    }),
  ],
  define: {
    'process.env.NODE_ENV': `"${process.env.NODE_ENV}"`,
  },
  external: ['obsidian'],
  minify: process.env.NODE_ENV === 'production',
})
.catch(() => process.exit(1));
