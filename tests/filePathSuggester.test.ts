import { filePathSuggest } from '../src/utils/filePathSuggester';

const PATHS = [
  'notes/project.md',
  'projects/overview.md',
  'archive/old-notes.md',
  'daily/2026-07-06.md'
];

describe('filePathSuggest', () => {
  it('returns an empty list for empty input', () => {
    expect(filePathSuggest('', PATHS)).toEqual([]);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filePathSuggest('zzz-does-not-exist', PATHS)).toEqual([]);
  });

  it('keeps only paths containing the input as a substring', () => {
    const result = filePathSuggest('project', PATHS);
    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining(['notes/project.md', 'projects/overview.md'])
    );
    expect(result).not.toContain('archive/old-notes.md');
  });

  it('ranks matches closer to the end of the path first (specificity)', () => {
    // 'notes' at the very end of 'archive/old-notes.md' (before '.md') is more
    // specific (3 trailing chars) than at the start of 'notes/project.md'
    // (12 trailing chars).
    const result = filePathSuggest('notes', [
      'notes/project.md',
      'archive/old-notes.md'
    ]);
    expect(result).toEqual(['archive/old-notes.md', 'notes/project.md']);
  });

  it('a full-suffix match outranks everything else', () => {
    const result = filePathSuggest('project.md', [
      'projects/overview.md', // no match at all
      'sub/dir/project.md', // suffix match, specificity 0
      'project.md.backup' // match with trailing chars
    ]);
    expect(result).toEqual(['sub/dir/project.md', 'project.md.backup']);
  });

  it('matches case-insensitively by default and preserves original casing', () => {
    const result = filePathSuggest('NOTES', ['folder/Notes.md', 'other/x.md']);
    expect(result).toEqual(['folder/Notes.md']);
  });

  it('respects case in case-sensitive mode', () => {
    const paths = ['folder/Notes.md', 'folder/notes.md'];
    expect(filePathSuggest('Notes', paths, true)).toEqual(['folder/Notes.md']);
    expect(filePathSuggest('notes', paths, true)).toEqual(['folder/notes.md']);
    expect(filePathSuggest('NOTES', paths, true)).toEqual([]);
  });

  it('keeps input order for equally specific matches (stable sort)', () => {
    const result = filePathSuggest('x.md', ['a/x.md', 'b/x.md']);
    expect(result).toEqual(['a/x.md', 'b/x.md']);
  });

  it('ignores paths shorter than the input without crashing', () => {
    expect(filePathSuggest('very/long/input/path.md', ['a.md'])).toEqual([]);
  });
});
