// Mirrors the checks the Obsidian community directory runs on each release,
// so findings can be reproduced and fixed locally instead of one release at a
// time. `recommendedTypeChecked` is what surfaces the no-unsafe-* family, and
// it needs type information, hence projectService.
import { readFileSync } from 'node:fs';
import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';

// Honor private dev exclusions locally. Public snapshots already omit those
// files and the private release list, so they need no additional ignores.
let releaseExcluded = [];
try {
  releaseExcluded = readFileSync(
    new URL('./scripts/release-exclude.txt', import.meta.url),
    'utf8'
  )
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((p) => (p.endsWith('/') ? `${p}**` : p));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

export default tseslint.config(
  {
    ignores: [
      'main.js',
      'node_modules/**',
      'tests/**',
      '*.config.mjs',
      '*.config.js',
      ...releaseExcluded
    ]
  },
  ...tseslint.configs.recommendedTypeChecked,
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  }
);
