
import { protectMarkdownSyntax } from './markdownSyntax';

export function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

// Native Obsidian tag token: non-ASCII letters/symbols are allowed, while
// punctuation ranges and ASCII delimiters terminate a tag. Keep this shared
// across extraction, indicator matching and exact-token concealment.
export const TAG_CHAR = `[^\\u2000-\\u206F\\u2E00-\\u2E7F'!"#$%&()*+,.:;<=>?@^\u0060{|}~\\[\\]\\\\\\s]`;
const TAG_START = '(?<![^\\s\\[])';

export function tagPattern(): RegExp {
  return new RegExp(`${TAG_START}#${TAG_CHAR}+`, 'gu');
}

/** Match an indicator prefix only at an exact tag or descendant boundary. */
export function indicatorTagPattern(indicatorTag: string, global = false): RegExp {
  return new RegExp(
    `${TAG_START}#${escapeRegExp(indicatorTag)}(?=/|(?!${TAG_CHAR}))`,
    global ? 'giu' : 'iu'
  );
}

export function exactIndicatorTagPattern(indicatorTag: string): RegExp {
  return new RegExp(`${TAG_START}#${escapeRegExp(indicatorTag)}(?!${TAG_CHAR})`, 'giu');
}

/** Match the indicator itself or a descendant tag, outside literal Markdown. */
export function hasIndicatorTag(text: string, indicatorTag: string): boolean {
  if (!indicatorTag) return false;
  const protectedSource = protectMarkdownSyntax(text);
  return [...text.matchAll(indicatorTagPattern(indicatorTag, true))]
    .some(match => !protectedSource.contains(match.index!));
}

export function extractTags(text: string): [string[], string] {
  const protectedSource = protectMarkdownSyntax(text);
  const matches = [...text.matchAll(tagPattern())]
    .filter(match => !protectedSource.contains(match.index!) && !/^#[0-9]+$/.test(match[0]));
  if (matches.length === 0) { return [[], text]; }
  const labels = matches.map(match => match[0]);

  // Remove the tags from the content and then trim any consecutive spaces greater than 2
  const validTags = new Set(labels);
  const remainingText = text
    .replace(new RegExp(`(\\s?)${TAG_START}#${TAG_CHAR}+(\\s?)`, 'gu'), (match, _before, _after, offset) => {
      return validTags.has(match.trim()) && !protectedSource.contains(offset + match.indexOf('#')) ? ' ' : match;
    })
    .trim();

  return [labels, remainingText];
}

/**
 * Get the starting index of a matching group within a given string.
 *
 * @param {string} text - The string to match against.
 * @param {RegExp} regex - The regular expression containing the match groups.
 * @param {number} groupIndex - The index of the desired match group.
 * @returns {number|null} The index in the string where the desired match group starts, or null if not found.
 */
export function getGroupStartIndex(
  text: string,
  regex: RegExp,
  groupIndex: number
): number | null {
  // Clone without g/y so the caller's regex lastIndex is never mutated, and
  // with 'd' so we get exact group offsets instead of guessing via indexOf
  // (which finds the wrong occurrence when the group text repeats).
  let flags = regex.flags.replace(/[gy]/g, '');
  if (!flags.includes('d')) flags += 'd';
  const cloned = new RegExp(regex.source, flags);
  const match = cloned.exec(text) as RegExpExecArray & {
    indices?: Array<[number, number] | undefined>;
  };
  if (match && match.indices && match.indices[groupIndex]) {
    return match.indices[groupIndex][0];
  }
  return null;
}
