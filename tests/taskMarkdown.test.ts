/** @jest-environment jsdom */
import { App, Component, MarkdownRenderer } from 'obsidian';
import { taskMarkdown } from '../src/ui/taskMarkdown';

test.each(['1. Review **the plan**', '## Review **the plan**', '> Review **the plan**'])
('renders a task title as inline content even when it starts with block syntax: %s', async markdown => {
  const node = document.createElement('div');
  const action = taskMarkdown(node, { app: new App(), markdown, inline: true });
  await action.ready;
  expect(node.querySelector('ol, ul, h1, h2, blockquote')).toBeNull();
  expect(node.querySelector('strong')?.textContent).toBe('the plan');
  expect(node.textContent?.trim()).toBe(markdown.replace('**the plan**', 'the plan'));
  action.destroy();
});

test('replaces a rendering and unloads its children, including a late async completion', async () => {
  let finish: () => void;
  (MarkdownRenderer.render as jest.Mock).mockImplementationOnce((_app, _text, el, _path, component: Component) => {
    component.register(() => el.dataset.unloaded = 'yes');
    return new Promise<void>(resolve => { finish = resolve; });
  });
  const app = new App();
  const node = document.body.appendChild(document.createElement('div'));
  const action = taskMarkdown(node, { app, markdown: 'old', sourcePath: 'Week.md' });
  await Promise.resolve();
  const oldHost = (MarkdownRenderer.render as jest.Mock).mock.calls.at(-1)![2];
  action.update({ app, markdown: 'new', sourcePath: 'Week.md' });
  await action.ready;
  finish!();
  // Allow the retired promise's cleanup to finish.
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(oldHost.dataset.unloaded).toBe('yes');
  expect(node.textContent?.trim()).toBe('new');
  const component = (MarkdownRenderer.render as jest.Mock).mock.calls.at(-1)![4];
  action.destroy();
  expect(component._loaded).toBe(false);
  node.remove();
});

test('resolves internal links from the task file and preserves native modifier handling', async () => {
  const app = new App();
  const node = document.body.appendChild(document.createElement('div'));
  const action = taskMarkdown(node, { app, markdown: 'a title', sourcePath: 'Plans/Week.md' });
  await action.ready;
  const link = node.appendChild(document.createElement('a'));
  link.className = 'internal-link';
  link.dataset.href = 'Note#Details';
  const label = link.appendChild(document.createElement('strong'));
  label.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
  expect(app.workspace.openLinkText).toHaveBeenCalledWith('Note#Details', 'Plans/Week.md', true);
  action.destroy(); node.remove();
});

test('failed rendering falls back to safe source text and releases render children', async () => {
  (MarkdownRenderer.render as jest.Mock).mockRejectedValueOnce(new Error('renderer unavailable'));
  const node = document.createElement('div');
  const action = taskMarkdown(node, { app: new App(), markdown: '<img src=x onerror=bad()>', sourcePath: 'Week.md' });
  await action.ready;
  expect(node.querySelector('img')).toBeNull();
  expect(node.textContent).toBe('<img src=x onerror=bad()>');
  const component = (MarkdownRenderer.render as jest.Mock).mock.calls.at(-1)![4];
  expect(component._loaded).toBe(false);
  action.destroy();
});

test('keeps field-like code literal when a postprocessor scans rendered HTML', async () => {
  (MarkdownRenderer.render as jest.Mock).mockImplementationOnce(async (_app, markdown, host) => {
    const parser = require('markdown-it')();
    // Dataview scans innerHTML, including code, for its field syntax.
    host.innerHTML = parser.render(markdown).replace(/\[due::[^\]]*\]/g, '<span>processed field</span>');
  });
  const node = document.createElement('div');
  const action = taskMarkdown(node, { app: new App(), markdown: 'Keep `[due:: tomorrow]` literal', sourcePath: 'Week.md' });
  await action.ready;
  expect(node.querySelector('code')?.textContent).toBe('[due:: tomorrow]');
  action.destroy();
});

test('passes fenced program source intact to native code block processors', async () => {
  const markdown = '```dataviewjs\ndv.paragraph("key::value");\n```';
  const action = taskMarkdown(document.createElement('div'), { app: new App(), markdown, sourcePath: 'Week.md' });
  await action.ready;
  expect((MarkdownRenderer.render as jest.Mock).mock.calls.at(-1)![1]).toBe(markdown);
  action.destroy();
});

test('leaves links inside note embeds to their native source context', async () => {
  const app = new App();
  const node = document.createElement('div');
  const action = taskMarkdown(node, { app, markdown: '![[Embedded/Note]]', sourcePath: 'Outer/Week.md' });
  await action.ready;
  const embed = node.appendChild(document.createElement('span'));
  embed.className = 'internal-embed';
  const link = embed.appendChild(document.createElement('a'));
  link.className = 'internal-link';
  link.dataset.href = 'Target';
  link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  expect(app.workspace.openLinkText).not.toHaveBeenCalled();
  action.destroy();
});
