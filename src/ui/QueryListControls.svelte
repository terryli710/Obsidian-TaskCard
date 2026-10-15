<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { normalizeListPresentation } from '../query/listPresentation';
  import type { ListPresentation } from '../query/listPresentation';

  export let presentation: ListPresentation = normalizeListPresentation();
  const dispatch = createEventDispatcher<{ change: ListPresentation }>();

  function change(key: keyof ListPresentation, value: string | boolean) {
    dispatch('change', normalizeListPresentation({ ...presentation, [key]: value }));
  }
</script>

<div class="organize-controls" aria-label="List organization">
  <label>Group by
    <select class="dropdown" aria-label="Group by" value={presentation.groupBy}
      on:change={event => change('groupBy', event.currentTarget.value)}>
      <option value="none">None</option><option value="project">Project</option><option value="priority">Importance</option>
    </select>
  </label>
  <label>Sort by
    <select class="dropdown" aria-label="Sort by" value={presentation.sortBy}
      on:change={event => change('sortBy', event.currentTarget.value)}>
      <option value="original">Original order</option><option value="priority">Importance</option><option value="due">Due date</option><option value="title">Task title</option>
    </select>
  </label>
  <label class="done-option" title="Place completed tasks after unfinished tasks within each group">
    <input type="checkbox" aria-label="Completed last" checked={presentation.completedLast}
      on:change={event => change('completedLast', event.currentTarget.checked)} /> Completed last
  </label>
</div>

<style>
  .organize-controls { display:flex; align-items:center; gap:8px 18px; flex-wrap:wrap; min-width:0; padding:0 2px 14px; font-size:var(--font-ui-smaller); color:var(--text-muted); }
  label { display:flex; align-items:center; gap:6px; min-width:0; }
  select { max-width:160px; min-width:0; }
  .done-option { margin-left:auto; }
  input { flex-shrink:0; margin:0; }
  select:focus-visible,input:focus-visible { outline:2px solid var(--interactive-accent); outline-offset:2px; }
  @media(max-width:700px) { .done-option { margin-left:0; } }
</style>
