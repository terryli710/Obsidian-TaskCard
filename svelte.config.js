const sveltePreprocess = require('svelte-preprocess');

// Consumed by svelte-jester (preprocess: true) so <script lang="ts"> components
// compile under Jest. The esbuild build configures its own preprocessing in
// esbuild.config.mjs and does not read this file.
module.exports = {
  preprocess: sveltePreprocess()
};
