import { App } from 'obsidian';
import { FileOperator } from '../src/renderer/fileOperator';

/**
 * FileOperator write-back tests.
 *
 * Line-number conventions in FileOperator (asserted below):
 * - getLineFromFile / updateLineInFile are 1-based.
 * - updateFile / getMarkdownBetweenLines are 0-based with an exclusive end
 *   (i.e. [lineStart, lineEnd) like Array.prototype.slice).
 */

const DOC_LINES = [
  '# Header',
  '- [ ] first task #TaskCard',
  'some text',
  '- [ ] middle task #TaskCard',
  '    - desc line 1',
  '    - desc line 2',
  'last line'
];
const DOC = DOC_LINES.join('\n');
const FILE_PATH = 'notes/tasks.md';

describe('FileOperator', () => {
  let app: App;
  let vault: any;
  let fileOperator: FileOperator;

  beforeEach(() => {
    app = new App();
    vault = app.vault as any;
    vault.__setFile(FILE_PATH, DOC);
    // FileOperator only stores the plugin reference; a bare stub suffices.
    fileOperator = new FileOperator({} as any, app);
  });

  describe('getFileContent', () => {
    it('returns the full file content', async () => {
      await expect(fileOperator.getFileContent(FILE_PATH)).resolves.toBe(DOC);
    });

    it('returns null for a missing file', async () => {
      await expect(fileOperator.getFileContent('missing.md')).resolves.toBeNull();
    });
  });

  describe('getFileLines', () => {
    it('splits the file into lines', async () => {
      const lines = await fileOperator.getFileLines(FILE_PATH);
      expect(lines).toEqual(DOC_LINES);
      expect(lines).toHaveLength(7);
    });

    it('returns null for a missing file', async () => {
      await expect(fileOperator.getFileLines('missing.md')).resolves.toBeNull();
    });

    it('returns a single empty line for an empty (but existing) file', async () => {
      // '' is a valid empty file, distinct from a missing file (null)
      vault.__setFile('empty.md', '');
      await expect(fileOperator.getFileLines('empty.md')).resolves.toEqual(['']);
    });
  });

  describe('getLineFromFile (1-based)', () => {
    it('returns the first line for lineNumber 1', async () => {
      await expect(fileOperator.getLineFromFile(FILE_PATH, 1)).resolves.toBe(
        '# Header'
      );
    });

    it('returns a middle line', async () => {
      await expect(fileOperator.getLineFromFile(FILE_PATH, 4)).resolves.toBe(
        '- [ ] middle task #TaskCard'
      );
    });

    it('returns the last line', async () => {
      await expect(fileOperator.getLineFromFile(FILE_PATH, 7)).resolves.toBe(
        'last line'
      );
    });

    it('returns null when lineNumber is past the end of the file', async () => {
      await expect(
        fileOperator.getLineFromFile(FILE_PATH, 8)
      ).resolves.toBeNull();
    });

    it('returns null for a missing file', async () => {
      await expect(
        fileOperator.getLineFromFile('missing.md', 1)
      ).resolves.toBeNull();
    });

    it('returns null for lineNumber 0 and negative line numbers', async () => {
      await expect(
        fileOperator.getLineFromFile(FILE_PATH, 0)
      ).resolves.toBeNull();
      await expect(
        fileOperator.getLineFromFile(FILE_PATH, -3)
      ).resolves.toBeNull();
    });
  });

  describe('getMarkdownBetweenLines (0-based, end-exclusive)', () => {
    it('returns the joined lines of the range', async () => {
      // middle task plus its two description lines
      await expect(
        fileOperator.getMarkdownBetweenLines(FILE_PATH, 3, 6)
      ).resolves.toBe(
        '- [ ] middle task #TaskCard\n    - desc line 1\n    - desc line 2'
      );
    });

    it('returns null for a missing file', async () => {
      await expect(
        fileOperator.getMarkdownBetweenLines('missing.md', 0, 1)
      ).resolves.toBeNull();
    });
  });

  describe('display-path reads (served from the vault cache)', () => {
    it('getFileContentForDisplay reads through vault.cachedRead, not vault.read', async () => {
      const cachedReadSpy = jest.spyOn(vault, 'cachedRead');
      await expect(
        fileOperator.getFileContentForDisplay(FILE_PATH)
      ).resolves.toBe(DOC);
      // the render path must avoid disk I/O or the raw section HTML gets a
      // frame to paint before the card mounts (the re-render blink)
      expect(cachedReadSpy).toHaveBeenCalledTimes(1);
    });

    it('getFileContentForDisplay returns null for a missing file', async () => {
      await expect(
        fileOperator.getFileContentForDisplay('missing.md')
      ).resolves.toBeNull();
    });

    it('getMarkdownBetweenLinesForDisplay matches the fresh-read variant (0-based, end-exclusive)', async () => {
      await expect(
        fileOperator.getMarkdownBetweenLinesForDisplay(FILE_PATH, 3, 6)
      ).resolves.toBe(
        '- [ ] middle task #TaskCard\n    - desc line 1\n    - desc line 2'
      );
    });

    it('getMarkdownBetweenLinesForDisplay returns null for a missing file', async () => {
      await expect(
        fileOperator.getMarkdownBetweenLinesForDisplay('missing.md', 0, 1)
      ).resolves.toBeNull();
    });
  });

  describe('updateFile (0-based, end-exclusive)', () => {
    const expectDocWithSplice = (
      start: number,
      end: number,
      replacement: string
    ): string => {
      const lines = [...DOC_LINES];
      lines.splice(start, end - start, replacement);
      return lines.join('\n');
    };

    it('patches the first line only', async () => {
      await fileOperator.updateFile(FILE_PATH, '# New Header', 0, 1);
      expect(vault.__getContent(FILE_PATH)).toBe(
        expectDocWithSplice(0, 1, '# New Header')
      );
    });

    it('patches a task on the first line and leaves the rest untouched', async () => {
      await fileOperator.updateFile(
        FILE_PATH,
        '- [x] first task #TaskCard',
        1,
        2
      );
      const newLines = vault.__getContent(FILE_PATH)!.split('\n');
      expect(newLines[1]).toBe('- [x] first task #TaskCard');
      // everything outside the patched range is byte-identical
      expect(newLines.slice(0, 1)).toEqual(DOC_LINES.slice(0, 1));
      expect(newLines.slice(2)).toEqual(DOC_LINES.slice(2));
    });

    it('patches the last line only', async () => {
      await fileOperator.updateFile(FILE_PATH, 'THE END', 6, 7);
      const newLines = vault.__getContent(FILE_PATH)!.split('\n');
      expect(newLines[6]).toBe('THE END');
      expect(newLines.slice(0, 6)).toEqual(DOC_LINES.slice(0, 6));
    });

    it('patches a middle line only', async () => {
      await fileOperator.updateFile(FILE_PATH, 'replaced text', 2, 3);
      const newLines = vault.__getContent(FILE_PATH)!.split('\n');
      expect(newLines[2]).toBe('replaced text');
      expect(newLines.slice(0, 2)).toEqual(DOC_LINES.slice(0, 2));
      expect(newLines.slice(3)).toEqual(DOC_LINES.slice(3));
    });

    it('patches a multi-line span (task + indented description) as one unit', async () => {
      const replacement =
        '- [x] middle task #TaskCard\n    - updated desc 1\n    - updated desc 2';
      await fileOperator.updateFile(FILE_PATH, replacement, 3, 6);
      expect(vault.__getContent(FILE_PATH)).toBe(
        expectDocWithSplice(3, 6, replacement)
      );
      const newLines = vault.__getContent(FILE_PATH)!.split('\n');
      expect(newLines.slice(0, 3)).toEqual(DOC_LINES.slice(0, 3));
      expect(newLines.slice(6)).toEqual(DOC_LINES.slice(6));
    });

    it('supports replacements that change the line count', async () => {
      // collapse the 3-line span (task + 2 description lines) into 1 line
      await fileOperator.updateFile(FILE_PATH, '- [ ] shrunk #TaskCard', 3, 6);
      const newLines = vault.__getContent(FILE_PATH)!.split('\n');
      expect(newLines).toEqual([
        ...DOC_LINES.slice(0, 3),
        '- [ ] shrunk #TaskCard',
        ...DOC_LINES.slice(6)
      ]);
    });

    it('inserts when lineStart === lineEnd', async () => {
      await fileOperator.updateFile(FILE_PATH, 'inserted line', 2, 2);
      const newLines = vault.__getContent(FILE_PATH)!.split('\n');
      expect(newLines).toEqual([
        ...DOC_LINES.slice(0, 2),
        'inserted line',
        ...DOC_LINES.slice(2)
      ]);
    });

    it('appends at the end when the range starts past the end of the file', async () => {
      // Documents current behavior: splice(10, 1, ...) on a 7-line file
      // silently appends instead of failing for out-of-range input.
      await fileOperator.updateFile(FILE_PATH, 'appended', 10, 11);
      expect(vault.__getContent(FILE_PATH)).toBe(DOC + '\nappended');
    });

    it('is a silent no-op for a missing file', async () => {
      await expect(
        fileOperator.updateFile('missing.md', 'x', 0, 1)
      ).resolves.toBeUndefined();
      expect(vault.__getContent('missing.md')).toBeUndefined();
      // seeded file untouched
      expect(vault.__getContent(FILE_PATH)).toBe(DOC);
    });

    it('can write into an empty (but existing) file', async () => {
      // an empty file is a single empty line; replacing [0, 1) fills it
      vault.__setFile('empty.md', '');
      await fileOperator.updateFile('empty.md', 'new content', 0, 1);
      expect(vault.__getContent('empty.md')).toBe('new content');
    });
  });

  describe('updateLineInFile (1-based)', () => {
    it('replaces exactly the addressed line', async () => {
      await fileOperator.updateLineInFile(FILE_PATH, 3, 'CHANGED');
      const newLines = vault.__getContent(FILE_PATH)!.split('\n');
      expect(newLines[2]).toBe('CHANGED');
      expect(newLines.slice(0, 2)).toEqual(DOC_LINES.slice(0, 2));
      expect(newLines.slice(3)).toEqual(DOC_LINES.slice(3));
    });

    it('silently extends the file with blank lines when the line is past the end', async () => {
      // Documents current behavior: assigning fileLines[8] on a 7-line file
      // creates a sparse array; join('\n') turns the holes into empty lines.
      await fileOperator.updateLineInFile(FILE_PATH, 9, 'far away');
      expect(vault.__getContent(FILE_PATH)).toBe(DOC + '\n\nfar away');
    });
  });

  describe('getAllFilesAndFolders', () => {
    it('lists markdown files plus every intermediate folder', () => {
      const freshApp = new App();
      (freshApp.vault as any).__setFile('a/b/c.md', 'x');
      (freshApp.vault as any).__setFile('a/d.md', 'y');
      (freshApp.vault as any).__setFile('root.md', 'z');
      const op = new FileOperator({} as any, freshApp);
      expect(op.getAllFilesAndFolders().sort()).toEqual(
        ['a/', 'a/b/', 'a/b/c.md', 'a/d.md', 'root.md'].sort()
      );
    });
  });
});
