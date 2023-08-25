import { logger } from '../utils/log';

export function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export function extractTags(text: string): [string[], string] {
  // Regular expression to detect valid tags based on the provided rules
  const tagRegex = /#([a-zA-Z_/-]+[a-zA-Z0-9_/-]*|[a-zA-Z_/-][a-zA-Z0-9_/-]+)/g;
  let matches = text.match(tagRegex) || [];
  // for the matches, get the label part (remove the #)
  let labels = matches.map((match) => match.substring(1));

  // Remove the tags from the content and then trim any consecutive spaces greater than 2
  const remainingText = text
    .replace(
      /(\s?)#([a-zA-Z_/-]+[a-zA-Z0-9_/-]*|[a-zA-Z_/-][a-zA-Z0-9_/-]+)(\s?)/g,
      ' '
    )
    .trim();

  labels = labels.map(label => {
    // Remove all leading '#' characters
    const cleanedLabel = label.replace(/^#+/, '');
    // Add a single '#' at the beginning
    return '#' + cleanedLabel;
  });

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
  const match = regex.exec(text);
  if (match && match[groupIndex]) {
    const fullMatchIndex = match.index;
    return fullMatchIndex + match[0].indexOf(match[groupIndex]);
  }
  return null;
}
