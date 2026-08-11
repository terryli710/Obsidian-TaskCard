// Obsidian plugin code always runs with a `window`, and the guidelines require
// window.setTimeout/setInterval so timers survive in popout windows. Jest's
// node environment has no window, so point it at globalThis for suites that do
// not opt into jsdom.
import { installInstanceOf } from './__helpers__/obsidianDom';

if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
  (globalThis as { window?: unknown }).window = globalThis;
}

installInstanceOf();
