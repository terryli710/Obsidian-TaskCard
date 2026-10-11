import { App, Component, Keymap, MarkdownRenderer } from 'obsidian';
import { protectCodeFields } from '../utils/markdownSyntax';

export interface TaskMarkdownOptions {
  app?: App;
  markdown: string;
  sourcePath?: string;
  inline?: boolean;
  onRendered?: (host: HTMLElement) => void;
}

/** Nested Markdown controls own their clicks; the card owns the surrounding text. */
export function isMarkdownControl(event: Event): boolean {
  const target = event.target as Element | null;
  return !!target?.closest?.('a, button, input, textarea, select, audio, video, .internal-embed');
}

/** Svelte action shared by live/query cards and the full-title popup.
 * Each rendering owns a Component and DOM subtree. Replaced async renders
 * can finish only in their detached subtree, never overwrite the new title.
 */
export function taskMarkdown(node: HTMLElement, options: TaskMarkdownOptions) {
  let rendering: { component: Component; pending: boolean } | undefined;
  let generation = 0;
  let ready = Promise.resolve();

  function render(next: TaskMarkdownOptions) {
    options = next;
    const current = ++generation;
    // Async renderers can register children until their promise settles.
    // Retire a pending owner at completion, after it has finished registering.
    if (rendering && !rendering.pending) rendering.component.unload();
    rendering = undefined;
    ready = Promise.resolve();
    node.textContent = next.markdown;
    if (!next.app || !next.markdown.trim()) return;

    const owner = new Component();
    const job = { component: owner, pending: true };
    rendering = job;
    owner.load();
    const host = node.ownerDocument.createElement('div');
    host.className = `task-card-markdown${next.inline ? ' task-card-markdown-inline' : ''}`;
    host.dataset.taskcardMarkdown = '';
    const protectedCode = protectCodeFields(next.markdown);
    ready = Promise.resolve().then(() => {
      if (current !== generation) return;
      // The API is a block renderer. A removable word joiner makes task
      // titles parse as paragraph content, as they do after a task checkbox
      // in a note ("1. ..." and "## ..." are literal title text).
      return MarkdownRenderer.render(next.app!, (next.inline ? '\u2060' : '') + protectedCode.markdown,
        host, next.sourcePath ?? '', owner);
    }).then(() => {
      if (current !== generation) return;
      protectedCode.restore(host);
      if (next.inline) {
        const firstText = host.ownerDocument.createTreeWalker(host, 4 /* SHOW_TEXT */).nextNode();
        if (firstText?.nodeValue?.startsWith('\u2060')) firstText.nodeValue = firstText.nodeValue.slice(1);
      }
      node.replaceChildren(host);
      next.onRendered?.(host);
    }).catch(error => {
      owner.unload();
      if (current !== generation) return;
      rendering = undefined;
      node.textContent = next.markdown;
      console.warn('TaskCard: Markdown rendering failed; showing source text.', error);
    }).finally(() => {
      job.pending = false;
      if (current !== generation) owner.unload();
    });
  }

  function onLink(event: MouseEvent) {
    const target = event.target as Element | null;
    const link = target?.closest?.('a');
    if (!link || !node.contains(link)) return;
    if (link.closest('.internal-embed')) return;
    // Query cards and body-portalled tooltips need the task's source path,
    // rather than the query note or whichever pane happens to be active.
    event.stopPropagation();
    if (link.classList.contains('internal-link') && options.app) {
      if (event.type === 'auxclick' && event.button !== 1) return;
      event.preventDefault();
      const href = link.getAttribute('data-href') ?? link.getAttribute('href');
      if (href) void options.app.workspace.openLinkText(
        href, options.sourcePath ?? '', event.button === 1 ? 'tab' : Keymap.isModEvent(event)
      );
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if (isMarkdownControl(event)) event.stopPropagation();
  }

  node.addEventListener('click', onLink);
  node.addEventListener('auxclick', onLink);
  node.addEventListener('keydown', onKeydown);
  render(options);
  return {
    get ready() { return ready; },
    update: render,
    destroy() {
      generation++;
      if (rendering && !rendering.pending) rendering.component.unload();
      node.removeEventListener('click', onLink);
      node.removeEventListener('auxclick', onLink);
      node.removeEventListener('keydown', onKeydown);
    }
  };
}
