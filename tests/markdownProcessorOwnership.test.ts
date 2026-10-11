/** @jest-environment jsdom */
jest.mock('../src/renderer/queryAndTaskListSvelteAdapter', () => ({ QueryAndTaskListSvelteAdapter: class {} }));
jest.mock('../src/renderer/postProcessor', () => ({ TaskItemSvelteAdapter: class {} }));
import { StaticTaskListRenderManager } from '../src/renderer/StaticTaskListRenderer';
import { TaskCardRenderManager } from '../src/renderer/TaskCardRenderer';

test('card-owned Markdown cannot recursively mount query cards or writable task cards', async () => {
  const host = document.createElement('div');
  host.dataset.taskcardMarkdown = '';
  const block = host.appendChild(document.createElement('div'));
  const ctx = { addChild: jest.fn(), getSectionInfo: jest.fn() } as any;
  await new StaticTaskListRenderManager({} as any).getCodeBlockProcessor()('file: "tasks.md"', block, ctx);
  await new TaskCardRenderManager({} as any).getPostProcessor()(block, ctx);
  expect(ctx.addChild).not.toHaveBeenCalled();
  expect(ctx.getSectionInfo).not.toHaveBeenCalled();
  expect(block.querySelector('code')?.textContent).toBe('file: "tasks.md"');
});
