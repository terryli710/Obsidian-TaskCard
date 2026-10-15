<script context="module" lang="ts">
  const activeProjects = new WeakMap<Document, () => void>();
  let nextId = 0;
</script>

<script lang="ts">
  import { createEventDispatcher, onDestroy, tick } from 'svelte';

  export let name: string;
  export let color: string;

  const dispatch = createEventDispatcher<{ projectopen: { name: string } }>();
  const id = `taskcard-query-project-${++nextId}`;
  let slot: HTMLSpanElement;
  let button: HTMLButtonElement;
  let menu: HTMLDivElement;
  let visible = false;
  let pinned = false;
  let moving = false;
  let pointerFocus = false;
  let destroyed = false;
  let ignorePointerEnter = false;
  let enterTimer: ReturnType<typeof setTimeout>;
  let leaveTimer: ReturnType<typeof setTimeout>;
  let stopListening: (() => void) | undefined;
  let returnToSlot: ((restoreFocus: boolean) => void) | undefined;

  function clearTimers() {
    clearTimeout(enterTimer);
    clearTimeout(leaveTimer);
  }

  function hide() {
    clearTimers();
    visible = false;
    pinned = false;
    pointerFocus = false;
    stopListening?.();
    stopListening = undefined;
    const doc = button?.ownerDocument;
    const restoreFocus = !destroyed && !!menu?.contains(doc?.activeElement);
    returnToSlot?.(restoreFocus);
    if (doc && activeProjects.get(doc) === hide) activeProjects.delete(doc);
  }

  // Only the active project listens to document events; long result lists do
  // not need a separate set of global listeners for every task.
  function listen() {
    const doc = button.ownerDocument;
    const win = doc.defaultView!;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!button.contains(target) && !menu?.contains(target)) hide();
    };
    const scroll = (event: Event) => {
      const target = event.target as Node;
      if (!button.contains(target) && !menu?.contains(target)) hide();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      ignorePointerEnter = true;
      hide();
      event.preventDefault();
      event.stopPropagation();
    };
    doc.addEventListener('pointerdown', outside, true);
    doc.addEventListener('scroll', scroll, true);
    doc.addEventListener('keydown', escape, true);
    win.addEventListener('resize', hide);
    win.addEventListener('blur', hide);
    return () => {
      doc.removeEventListener('pointerdown', outside, true);
      doc.removeEventListener('scroll', scroll, true);
      doc.removeEventListener('keydown', escape, true);
      win.removeEventListener('resize', hide);
      win.removeEventListener('blur', hide);
    };
  }

  function show() {
    if (moving || destroyed) return;
    clearTimers();
    const doc = button.ownerDocument;
    if (activeProjects.get(doc) !== hide) activeProjects.get(doc)?.();
    activeProjects.set(doc, hide);
    visible = true;
    if (!stopListening) stopListening = listen();
  }

  function enter() {
    clearTimers();
    if (!visible && !ignorePointerEnter && !pointerFocus) enterTimer = setTimeout(show, 140);
  }

  function leave() {
    clearTimers();
    if (!button.matches(':hover')) ignorePointerEnter = false;
    if (!pinned && button.ownerDocument.activeElement !== button) {
      leaveTimer = setTimeout(() => {
        if (!button.matches(':hover')) hide();
      }, 170);
    }
  }

  function pointerDown() {
    // Keep the click target in place until native click is dispatched. Moving
    // it on pointer-induced focus can make Chromium cancel a quick click.
    pointerFocus = true;
    clearTimers();
  }

  function focus() {
    if (moving || pointerFocus) return;
    ignorePointerEnter = false;
    show();
  }

  function blur(event: FocusEvent) {
    if (!moving && event.relatedTarget !== button && !menu?.contains(event.relatedTarget as Node)) hide();
  }

  function tab(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const fromMenu = menu?.contains(event.target as Node);
    ignorePointerEnter = true;
    // Restore the trigger synchronously so the browser follows the row's
    // normal Tab order, rather than the portal's position at the end of body.
    hide();
    if (fromMenu && event.shiftKey) event.preventDefault();
  }

  async function activate() {
    pointerFocus = false;
    if (pinned) { hide(); return; }
    show();
    pinned = true;
    await tick();
    if (!destroyed && pinned) menu?.querySelector('button')?.focus({ preventScroll: true });
  }

  function openProject() {
    hide();
    dispatch('projectopen', { name });
  }

  // Reparent the same button and dot to escape clipped matrix columns. The
  // reserved slot keeps row geometry unchanged; right padding fixes the dot
  // at its original center while the name extends to the left.
  function stationary(node: HTMLButtonElement, expanded: boolean) {
    const doc = node.ownerDocument;
    const win = doc.defaultView!;
    function move(target: HTMLElement) {
      const focused = doc.activeElement === node;
      moving = true;
      target.appendChild(node);
      if (focused) node.focus({ preventScroll: true });
      moving = false;
    }
    function restore(restoreFocus: boolean) {
      const focused = restoreFocus || doc.activeElement === node;
      moving = true;
      if (slot && node.parentElement !== slot) slot.appendChild(node);
      node.removeAttribute('style');
      if (focused && node.isConnected) node.focus({ preventScroll: true });
      moving = false;
    }
    returnToSlot = restore;
    function position() {
      if (destroyed || !visible || !node.isConnected) return;
      const anchor = slot.getBoundingClientRect();
      const viewport = win.visualViewport;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const height = viewport?.height ?? win.innerHeight;
      const centerY = anchor.top + anchor.height / 2;
      const maxHeight = Math.max(anchor.height, 2 * Math.min(centerY - top - 12, top + height - 12 - centerY));
      node.style.paddingRight = `${(anchor.width - 10) / 2}px`;
      node.style.maxWidth = `${Math.max(anchor.width, Math.min(320, anchor.right - left - 12))}px`;
      node.style.maxHeight = `${maxHeight}px`;
      node.style.setProperty('--query-project-label-height', `${Math.max(1, maxHeight - 12)}px`);
      const box = node.getBoundingClientRect();
      node.style.left = `${anchor.right + 1 - box.width}px`;
      node.style.top = `${anchor.top + (anchor.height - box.height) / 2}px`;
    }
    function update(value: boolean) {
      if (value) {
        move(doc.body);
        tick().then(position);
      } else if (slot && node.parentElement !== slot) {
        restore(false);
      }
    }
    update(expanded);
    return {
      update,
      destroy() {
        returnToSlot = undefined;
        if (node.parentElement === doc.body) node.remove();
      }
    };
  }

  function menuPortal(node: HTMLDivElement) {
    const doc = node.ownerDocument;
    const win = doc.defaultView!;
    doc.body.appendChild(node);
    tick().then(() => {
      if (destroyed || !pinned || !node.isConnected) return;
      const box = button.getBoundingClientRect();
      const width = Math.min(win.innerWidth - 24, Math.max(180, box.width));
      node.style.width = `${width}px`;
      node.style.left = `${Math.max(12, Math.min(box.right - width, win.innerWidth - width - 12))}px`;
      const height = node.getBoundingClientRect().height;
      node.style.top = `${box.bottom + 4 + height <= win.innerHeight - 12 ? box.bottom + 4 : box.top - height - 4}px`;
    });
    return { destroy() { node.remove(); } };
  }

  onDestroy(() => {
    destroyed = true;
    hide();
  });
</script>

<span class="query-project-slot" bind:this={slot}>
  <button class="query-project-button" class:expanded={visible} bind:this={button}
    type="button" aria-label="Project: {name}" aria-haspopup="dialog"
    aria-expanded={pinned} aria-controls={pinned ? id : undefined}
    use:stationary={visible} on:mouseenter={enter} on:mouseleave={leave}
    on:pointerdown={pointerDown} on:pointerup={() => pointerFocus = false}
    on:pointercancel={() => pointerFocus = false}
    on:focus={focus} on:blur={blur} on:keydown={tab} on:click|stopPropagation={activate}>
    {#if visible}<span class="query-project-name" aria-hidden="true">{name}</span>{/if}
    <span class="query-project-dot" style:background-color={color} aria-hidden="true" />
  </button>
</span>
{#if pinned}
  <div class="query-project-menu" bind:this={menu} id={id} role="dialog" aria-label="Actions for {name}"
    use:menuPortal on:mouseenter={clearTimers} on:mouseleave={leave} on:focusout={blur}>
    <button class="query-project-open" type="button" on:keydown={tab} on:click|stopPropagation={openProject}>Show project tasks</button>
  </div>
{/if}

<style>
  .query-project-slot {
    flex-shrink: 0;
    position: relative;
    display: block;
    width: 24px;
    height: calc(var(--line-height-normal) * var(--font-text-size));
    min-height: 24px;
  }
  .query-project-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    width: 24px;
    height: 100%;
    min-width: 24px;
    min-height: 24px;
    margin: 0 !important;
    padding: 0;
    border: 0;
    border-radius: 5px;
    background: transparent !important;
    box-shadow: none !important;
    color: var(--text-normal);
    font: inherit;
    cursor: pointer;
    box-sizing: border-box;
    transition: none !important;
  }
  .query-project-button.expanded {
    position: fixed;
    z-index: 10000;
    justify-content: flex-end;
    width: max-content;
    height: auto;
    min-height: 28px;
    padding: 5px 7px 5px 10px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary) !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, .10) !important;
    font-family: var(--font-interface, var(--font-text));
    font-size: var(--font-ui-small, 13px);
    line-height: 1.4;
  }
  .query-project-button:focus-visible,
  .query-project-open:focus-visible {
    outline: 2px solid var(--text-accent);
    outline-offset: 2px;
  }
  .query-project-dot {
    display: block;
    flex: 0 0 10px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .query-project-name {
    display: block;
    min-width: 0;
    max-height: var(--query-project-label-height);
    overflow: auto;
    overflow-wrap: anywhere;
    white-space: normal;
    text-align: left;
  }
  .query-project-menu {
    position: fixed;
    z-index: 10001;
    box-sizing: border-box;
    padding: 4px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, .10);
  }
  .query-project-open {
    display: block;
    width: 100%;
    height: auto;
    min-height: 30px;
    margin: 0 !important;
    padding: 6px 8px !important;
    border: 0;
    border-radius: 3px;
    background: transparent !important;
    box-shadow: none !important;
    text-align: left;
    color: var(--text-normal);
    font-family: var(--font-interface, var(--font-text));
    font-size: var(--font-ui-small, 13px);
    cursor: pointer;
  }
  .query-project-open:hover { background: var(--background-modifier-hover) !important; }
</style>
