/**
 * Minimal deep merge for plugin settings, replacing lodash's `merge`.
 *
 * Only the behaviours settings-loading actually depends on are reproduced:
 *
 * - plain objects merge recursively, so a settings group gains newly added
 *   default keys without discarding the user's existing values in that group;
 * - a source that is not a plain object — including `null` and `undefined` —
 *   is skipped rather than replacing the accumulated result. `loadData()`
 *   returns null on a fresh install, so this is the first-run path, not an
 *   edge case: letting it through would hand back null instead of defaults;
 * - `undefined` property values are skipped, so a key absent from the stored
 *   data.json keeps its default rather than being blanked;
 * - `null` property values overwrite, since null is a value the settings model
 *   uses deliberately (e.g. a cleared default project);
 * - arrays are taken wholesale from the source rather than merged by index.
 *
 * That last point is the one intentional divergence from lodash, which merges
 * arrays by index and would leave stale tail elements behind when the source
 * array is shorter. It is unobservable for this settings tree — the only array
 * in DefaultSettings is `userMetadata.projects`, which defaults to `[]`, so
 * both strategies yield the stored array — and wholesale replacement is the
 * behaviour you want if a default array is ever given entries: deleting a
 * project in the UI must not resurrect a default at that index.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === Object.prototype || proto === null;
}

/**
 * The result type is the caller's assertion about the merged shape, not an
 * inference from the (usually empty) seed object — merging arbitrary stored
 * JSON cannot be type-checked, so name the expected type at the call site.
 */
export function deepMerge<T = unknown>(
  target: unknown,
  ...sources: unknown[]
): T {
  let result: unknown = target;
  for (const source of sources) {
    if (!isPlainObject(source)) continue;
    result = mergeObjects(result, source);
  }
  return result as T;
}

function mergeObjects(
  target: unknown,
  source: Record<string, unknown>
): Record<string, unknown> {
  const base: Record<string, unknown> = isPlainObject(target) ? target : {};
  const out: Record<string, unknown> = { ...base };

  for (const key of Object.keys(source)) {
    const nextValue = source[key];
    if (nextValue === undefined) continue;
    if (isPlainObject(nextValue)) {
      out[key] = mergeObjects(base[key], nextValue);
    } else if (Array.isArray(nextValue)) {
      // Copied rather than aliased so later mutation of the merged settings
      // cannot write back into the caller's defaults or the loaded data.
      out[key] = nextValue.map((entry) =>
        isPlainObject(entry) ? mergeObjects({}, entry) : entry
      );
    } else {
      out[key] = nextValue;
    }
  }
  return out;
}
