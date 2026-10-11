/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { truncatedTitle } from '../src/ui/truncatedTitle';
import { App } from 'obsidian';

const actions: ReturnType<typeof truncatedTitle>[] = [];
function fixture(width = 120, scrollWidth = 600, content = 'A complete task title <img src=x onerror=alert(1)>') {
  const control = document.body.appendChild(document.createElement('div'));
  control.tabIndex = 0;
  const node = control.appendChild(document.createElement('div'));
  Object.defineProperties(node, {
    clientWidth: { configurable: true, value: width },
    scrollWidth: { configurable: true, value: scrollWidth }
  });
  const action = truncatedTitle(node, content);
  actions.push(action);
  return { control, node, action, content };
}
const tooltip = () => document.querySelector<HTMLElement>('[role="tooltip"]');
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  actions.splice(0).forEach(action => action.destroy());
  document.body.replaceChildren();
  jest.useRealTimers();
});

test('fitting and unmeasured titles never open a popup', () => {
  for (const [width, scroll] of [[120, 120], [0, 600]]) {
    const { node, control } = fixture(width, scroll);
    node.dispatchEvent(new MouseEvent('mouseenter'));
    jest.advanceTimersByTime(140);
    control.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(tooltip()).toBeNull();
  }
});

test('formatted hover content appears immediately while its native render completes', () => {
  const { node, action } = fixture();
  node.innerHTML = '<a class="internal-link" data-href="Note">the plan</a>';
  action.update({ app: new App(), markdown: '[[Note|the plan]]', sourcePath: 'Week.md', inline: true });
  node.dispatchEvent(new MouseEvent('mouseenter'));
  jest.advanceTimersByTime(140);
  expect(tooltip()?.querySelector('a')?.textContent).toBe('the plan');
  expect(tooltip()?.textContent).not.toContain('[[');
});

test('the hover grace period lets the reader enter and select safe, complete text', () => {
  const { node, control, content } = fixture();
  control.setAttribute('aria-describedby', 'existing-help');
  node.dispatchEvent(new MouseEvent('mouseenter'));
  jest.advanceTimersByTime(140);
  expect(tooltip()!.querySelector('.task-card-title-tooltip-content')!.textContent).toBe(content);
  expect(tooltip()!.querySelector('img')).toBeNull();
  const id = tooltip()!.id;
  expect(control.getAttribute('aria-describedby')).toBe(`existing-help ${id}`);
  node.dispatchEvent(new MouseEvent('mouseleave'));
  jest.advanceTimersByTime(169);
  tooltip()!.dispatchEvent(new MouseEvent('mouseenter'));
  // Clicking to select tooltip text moves focus away from the task control.
  control.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  jest.advanceTimersByTime(500);
  expect(tooltip()).not.toBeNull();
  tooltip()!.dispatchEvent(new MouseEvent('mouseleave'));
  jest.advanceTimersByTime(170);
  expect(tooltip()).toBeNull();
  expect(control.getAttribute('aria-describedby')).toBe('existing-help');
});

test('only the focused title control opens the popup, with one popup per document', () => {
  const first = fixture();
  const checkbox = first.control.appendChild(document.createElement('input'));
  checkbox.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  expect(tooltip()).toBeNull();
  first.control.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  const second = fixture(120, 600, 'Another complete task title');
  second.node.dispatchEvent(new MouseEvent('mouseenter'));
  jest.advanceTimersByTime(140);
  expect(document.querySelectorAll('[role="tooltip"]')).toHaveLength(1);
  expect(tooltip()).toHaveTextContent('Another complete task title');
  expect(first.control).not.toHaveAttribute('aria-describedby');
});

test('changing content and unmounting cancel stale popups and pending hovers', () => {
  const { control, node, action } = fixture();
  control.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  action.update('Updated title');
  expect(tooltip()).toBeNull();
  control.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  expect(tooltip()).toHaveTextContent('Updated title');
  action.destroy();
  expect(tooltip()).toBeNull();
  node.dispatchEvent(new MouseEvent('mouseenter'));
  jest.advanceTimersByTime(140);
  expect(tooltip()).toBeNull();
  const pending = fixture();
  pending.node.dispatchEvent(new MouseEvent('mouseenter'));
  pending.action.destroy();
  jest.advanceTimersByTime(140);
  expect(tooltip()).toBeNull();
});

test('scrolling the pane closes the popup while scrolling inside it keeps it readable', () => {
  const { control } = fixture();
  control.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  tooltip()!.dispatchEvent(new Event('scroll'));
  expect(tooltip()).not.toBeNull();
  control.dispatchEvent(new Event('scroll'));
  expect(tooltip()).toBeNull();
});
