import { markdownToHTML } from '../src/utils/markdownToHTML';

// markdownToHTML wraps a showdown Converter; it needs no DOM, so this suite
// runs in the default node environment.

describe('markdownToHTML', () => {
  it('converts bold text', () => {
    const html = markdownToHTML('**bold**');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toMatch(/^<p>.*<\/p>$/);
  });

  it('converts italic text', () => {
    expect(markdownToHTML('*italic*')).toContain('<em>italic</em>');
  });

  it('converts links with href and text', () => {
    const html = markdownToHTML('[Obsidian](https://obsidian.md)');
    expect(html).toContain('href="https://obsidian.md"');
    expect(html).toContain('>Obsidian</a>');
  });

  it('converts unordered lists into ul/li structure', () => {
    const html = markdownToHTML('- first\n- second');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>first</li>');
    expect(html).toContain('<li>second</li>');
    expect(html).toContain('</ul>');
  });

  it('converts inline code', () => {
    expect(markdownToHTML('use `npm test` here')).toContain(
      '<code>npm test</code>'
    );
  });

  it('returns an empty string for empty input', () => {
    expect(markdownToHTML('')).toBe('');
  });

  it('wraps plain text in a paragraph', () => {
    expect(markdownToHTML('hello world')).toBe('<p>hello world</p>');
  });
});
