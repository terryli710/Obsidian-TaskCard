import { taskMarkdown, TaskMarkdownOptions } from './taskMarkdown';

// Shared by live cards and query results. The body portal avoids clipping by
// the reading pane and keeps revealing a title from changing the list layout.
const activeTooltips = new WeakMap<Document, () => void>();
let nextTooltipId = 0;

export function truncatedTitle(node: HTMLElement, content: string | TaskMarkdownOptions) {
  const doc = node.ownerDocument;
  const win = doc.defaultView!;
  const focusTarget = node.closest<HTMLElement>('[tabindex]') ?? node;
  let tooltip: HTMLDivElement | null = null;
  let pointerInsideTooltip = false;
  let showTimer: number | undefined;
  let hideTimer: number | undefined;
  let renderedTooltip: ReturnType<typeof taskMarkdown> | undefined;

  const clipped = () => node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 1;
  function clearTimers() {
    win.clearTimeout(showTimer);
    win.clearTimeout(hideTimer);
    showTimer = hideTimer = undefined;
  }

  function hide() {
    clearTimers();
    if (!tooltip) return;
    const ids = (focusTarget.getAttribute('aria-describedby') ?? '')
      .split(/\s+/).filter(id => id && id !== tooltip!.id);
    if (ids.length) focusTarget.setAttribute('aria-describedby', ids.join(' '));
    else focusTarget.removeAttribute('aria-describedby');
    renderedTooltip?.destroy();
    renderedTooltip = undefined;
    tooltip.remove();
    tooltip = null;
    pointerInsideTooltip = false;
    doc.removeEventListener('scroll', onScroll, true);
    doc.removeEventListener('pointerdown', onOutsidePointer, true);
    doc.removeEventListener('keydown', onEscape, true);
    win.removeEventListener('resize', reposition);
    win.removeEventListener('blur', hide);
    if (activeTooltips.get(doc) === hide) activeTooltips.delete(doc);
  }

  function reposition() {
    if (!tooltip) return;
    if (!clipped() || !node.isConnected) { hide(); return; }
    const font = win.getComputedStyle(node);
    for (const property of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight'] as const) {
      tooltip.style[property] = font[property];
    }
    const anchor = (node.closest('.task-card-single-line') ?? node).getBoundingClientRect();
    const margin = 12;
    const gap = 6;
    const viewport = win.visualViewport;
    const leftEdge = viewport?.offsetLeft ?? 0;
    const topEdge = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? win.innerWidth;
    const height = viewport?.height ?? win.innerHeight;
    tooltip.style.width = `${Math.max(1, Math.min(520, width - margin * 2))}px`;
    tooltip.style.maxHeight = `${Math.max(1, height - margin * 2)}px`;
    const size = tooltip.getBoundingClientRect();
    const below = Math.max(0, topEdge + height - margin - anchor.bottom - gap);
    const above = Math.max(0, anchor.top - gap - topEdge - margin);
    const useAbove = size.height > below && above > below;
    tooltip.style.maxHeight = `${Math.max(1, useAbove ? above : below)}px`;
    const actualHeight = tooltip.getBoundingClientRect().height;
    tooltip.style.left = `${Math.max(leftEdge + margin,
      Math.min(node.getBoundingClientRect().left, leftEdge + width - margin - size.width))}px`;
    tooltip.style.top = `${Math.max(topEdge + margin, useAbove
      ? anchor.top - gap - actualHeight : anchor.bottom + gap)}px`;
  }

  function show() {
    clearTimers();
    if (tooltip || !clipped() || !node.isConnected) return;
    activeTooltips.get(doc)?.();
    activeTooltips.set(doc, hide);
    tooltip = doc.createElement('div');
    tooltip.className = 'task-card-title-tooltip';
    tooltip.id = `task-card-title-tooltip-${++nextTooltipId}`;
    tooltip.setAttribute('role', 'tooltip');
    const text = tooltip.appendChild(doc.createElement('div'));
    text.className = 'task-card-title-tooltip-content';
    if (typeof content === 'string') text.textContent = content;
    else {
      // Reveal the already-rendered title at 140ms, including formatting.
      // The native render supplies a fresh lifecycle for links and embeds.
      const snapshot = [...node.childNodes].map(child => child.cloneNode(true));
      renderedTooltip = taskMarkdown(text, { ...content, inline: true, onRendered: reposition });
      text.replaceChildren(...snapshot);
    }
    const caption = tooltip.appendChild(doc.createElement('div'));
    caption.className = 'task-card-title-tooltip-caption';
    caption.textContent = 'Full task title';
    tooltip.addEventListener('mouseenter', () => {
      pointerInsideTooltip = true;
      clearTimers();
    });
    tooltip.addEventListener('mouseleave', () => {
      pointerInsideTooltip = false;
      leave();
    });
    tooltip.addEventListener('focusin', clearTimers);
    tooltip.addEventListener('focusout', event => {
      if (!tooltip?.contains(event.relatedTarget as Node)) leave();
    });
    doc.body.appendChild(tooltip);
    const describedBy = focusTarget.getAttribute('aria-describedby');
    focusTarget.setAttribute('aria-describedby', [describedBy, tooltip.id].filter(Boolean).join(' '));
    reposition();
    doc.addEventListener('scroll', onScroll, true);
    doc.addEventListener('pointerdown', onOutsidePointer, true);
    doc.addEventListener('keydown', onEscape, true);
    win.addEventListener('resize', reposition);
    win.addEventListener('blur', hide);
  }

  function enter() {
    clearTimers();
    showTimer = win.setTimeout(show, 140);
  }
  function leave() {
    clearTimers();
    if (tooltip?.contains(doc.activeElement)) return;
    if (tooltip) hideTimer = win.setTimeout(hide, 170);
  }
  function onFocus(event: FocusEvent) {
    // Focusing the checkbox or a metadata control shouldn't reveal the title.
    if (event.target === focusTarget) show();
  }
  function onFocusOut(event: FocusEvent) {
    if (tooltip?.contains(event.relatedTarget as Node)) return;
    if (event.target === focusTarget && !pointerInsideTooltip) hide();
  }
  function onEscape(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    hide();
    event.preventDefault();
    event.stopPropagation();
  }
  function onActivate(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') hide();
    else if (event.key === 'Escape') hide();
  }
  function onScroll(event: Event) {
    if (!tooltip?.contains(event.target as Node)) hide();
  }
  function onOutsidePointer(event: Event) {
    if (!tooltip?.contains(event.target as Node)) hide();
  }

  node.addEventListener('mouseenter', enter);
  node.addEventListener('mouseleave', leave);
  focusTarget.addEventListener('focusin', onFocus);
  focusTarget.addEventListener('focusout', onFocusOut);
  focusTarget.addEventListener('click', hide, true);
  focusTarget.addEventListener('keydown', onActivate, true);
  const observer = win.ResizeObserver ? new win.ResizeObserver(reposition) : null;
  observer?.observe(node);

  return {
    update(nextContent: string | TaskMarkdownOptions) {
      content = nextContent;
      hide();
    },
    destroy() {
      hide();
      observer?.disconnect();
      node.removeEventListener('mouseenter', enter);
      node.removeEventListener('mouseleave', leave);
      focusTarget.removeEventListener('focusin', onFocus);
      focusTarget.removeEventListener('focusout', onFocusOut);
      focusTarget.removeEventListener('click', hide, true);
      focusTarget.removeEventListener('keydown', onActivate, true);
    }
  };
}
