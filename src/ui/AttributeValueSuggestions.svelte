<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Project } from '../taskModule/project';
  import {
    buildAttributeValueSuggestions,
    type AttributeValueKey,
    type AttributeValueSuggestion
  } from '../autoSuggestions/valueSuggestions';

  export let field: AttributeValueKey;
  export let query = '';
  export let projects: Project[] = [];
  export let labels: string[] = [];
  export let includeDefaults = true;

  const dispatch = createEventDispatcher<{
    choose: AttributeValueSuggestion;
    dismiss: void;
  }>();

  let suggestions: AttributeValueSuggestion[] = [];
  let selectedIndex = 0;
  let lastSignature = '';

  $: {
    suggestions = buildAttributeValueSuggestions(field, query, {
      projects,
      labels,
      includeDefaults
    });
    const signature = suggestions.map((suggestion) => suggestion.value).join('\u0000');
    if (signature !== lastSignature) {
      selectedIndex = 0;
      lastSignature = signature;
    }
  }

  function choose(suggestion: AttributeValueSuggestion) {
    dispatch('choose', suggestion);
  }

  export function handleKeydown(event: KeyboardEvent): boolean {
    if (event.key === 'Escape') {
      event.preventDefault();
      dispatch('dismiss');
      return true;
    }
    if (suggestions.length === 0) return false;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      selectedIndex = (selectedIndex + direction + suggestions.length) % suggestions.length;
      return true;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      choose(suggestions[selectedIndex]);
      return true;
    }
    return false;
  }
</script>

<div class="task-card-value-suggestions" role="listbox" aria-label={`${field} suggestions`}>
  {#if suggestions.length > 0}
    {#each suggestions as suggestion, index}
      <button
        type="button"
        class="task-card-value-suggestion"
        class:selected={index === selectedIndex}
        class:parsed={suggestion.kind === 'date-preview' || suggestion.kind === 'value-preview'}
        role="option"
        aria-selected={index === selectedIndex}
        on:mouseenter={() => (selectedIndex = index)}
        on:mousedown|preventDefault={() => choose(suggestion)}
      >
        {#if suggestion.color}
          <span class="suggestion-color" style={`background-color: ${suggestion.color}`} />
        {/if}
        <span class="suggestion-label">{suggestion.accentText ?? suggestion.displayText}</span>
        {#if suggestion.hint}
          <span class="suggestion-hint">{suggestion.hint}</span>
        {/if}
      </button>
    {/each}
  {:else}
    <div class="task-card-value-suggestion empty">No matching values</div>
  {/if}
  <div class="task-card-value-suggestion-footer">
    <span>↑↓ navigate</span>
    <span>Enter/Tab choose</span>
  </div>
</div>

<style>
  .task-card-value-suggestions {
    position: absolute;
    z-index: 30;
    top: calc(100% + 6px);
    left: 0;
    min-width: 210px;
    max-width: min(280px, calc(100vw - 32px));
    overflow: hidden;
    box-sizing: border-box;
    padding: 5px;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    background-color: var(--background-primary);
    box-shadow: 0 5px 18px rgba(0, 0, 0, 0.16);
    color: var(--text-normal);
  }

  .task-card-value-suggestion {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    min-width: 0;
    min-height: 28px;
    box-sizing: border-box;
    margin: 0;
    padding: 6px 9px;
    overflow: hidden;
    border: 0;
    border-radius: 7px;
    background: transparent;
    box-shadow: none !important;
    color: var(--text-normal);
    font-size: var(--font-ui-small);
    line-height: 1.2;
    text-align: left;
    white-space: nowrap;
    cursor: pointer;
  }

  .task-card-value-suggestion + .task-card-value-suggestion {
    margin-top: 2px;
  }

  .task-card-value-suggestion:hover,
  .task-card-value-suggestion.selected {
    background-color: var(--background-modifier-hover);
  }

  .task-card-value-suggestion.parsed {
    background-color: color-mix(in srgb, var(--text-accent) 7%, transparent);
    color: var(--text-accent);
    font-weight: 600;
  }

  .task-card-value-suggestion.parsed:hover,
  .task-card-value-suggestion.parsed.selected {
    background-color: color-mix(in srgb, var(--text-accent) 14%, transparent);
  }

  .task-card-value-suggestion.empty {
    color: var(--text-faint);
    cursor: default;
  }

  .suggestion-color {
    width: 7px;
    height: 7px;
    flex: 0 0 auto;
    border-radius: 999px;
  }

  .suggestion-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .suggestion-hint {
    max-width: 46%;
    margin-left: auto;
    overflow: hidden;
    flex: 0 1 auto;
    color: var(--text-faint);
    font-weight: 400;
    text-overflow: ellipsis;
  }

  .task-card-value-suggestion-footer {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin: 5px 5px 0;
    padding: 6px 4px 1px;
    border-top: 1px solid var(--background-modifier-border);
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    line-height: 1.2;
    white-space: nowrap;
  }
</style>
