// Mirrors the checks the Obsidian community directory runs on each release,
// so findings can be reproduced and fixed locally instead of one release at a
// time. `recommendedTypeChecked` is what surfaces the no-unsafe-* family, and
// it needs type information, hence projectService.
import { readFileSync } from 'node:fs';
import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';

// The directory only ever sees the public snapshot, so lint exactly that set:
// anything release-exclude.txt strips is dev-only and would inflate local
// counts with findings no reviewer can see. Reading the list here keeps the
// two from drifting apart.
const releaseExcluded = readFileSync(
  new URL('./scripts/release-exclude.txt', import.meta.url),
  'utf8'
)
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
  .map((p) => (p.endsWith('/') ? `${p}**` : p));

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
