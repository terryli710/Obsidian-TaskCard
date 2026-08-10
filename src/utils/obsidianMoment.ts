import { moment as obsidianMoment } from 'obsidian';
import type momentPkg from 'moment';

/**
 * The moment instance Obsidian already bundles.
 *
 * Importing `moment` from the npm package instead would bundle a second copy
 * (~63 KB) and lean on an undeclared transitive dependency, so every caller
 * goes through here.
 *
 * The cast is needed because obsidian.d.ts declares the re-export as
 * `typeof Moment` from `import * as Moment from 'moment'`, and under this
 * repo's `esModuleInterop: true` a namespace import of an `export =` module is
 * deliberately not callable — so `moment()` fails to typecheck without it. The
 * `moment` import here is type-only and erases at build time; nothing from the
 * package ships.
 */
export const moment = obsidianMoment as unknown as typeof momentPkg;

/** Convenience alias so callers don't reach for the UMD global namespace. */
export type Moment = ReturnType<typeof moment>;
