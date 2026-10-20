<script lang="ts">
    import { ObsidianTaskSyncManager } from '../taskModule/taskSyncManager';
    import { tick } from 'svelte';
    import { DescriptionParser } from '../taskModule/description';
    import { ObsidianTask } from "../taskModule/task";
    import { descriptionMarkdownForDisplay, descriptionTaskLines } from '../taskModule/descriptionMarkdown';
    import { SettingStore } from '../settings';
    import { get } from 'svelte/store';
    import TaskCardPlugin from '../index';
    import { isMarkdownControl, taskMarkdown } from './taskMarkdown';

    export let interactive: boolean = true;
    export let taskSyncManager: ObsidianTaskSyncManager = undefined;
    export let taskItem: ObsidianTask = undefined;
    export let displayDescription: boolean;
    export let plugin: TaskCardPlugin = undefined;
    export let sourcePath: string = undefined;
    export let showProgress = true;

    let description = interactive ? taskSyncManager.obsidianTask.description : taskItem.description;
    let inputElement: HTMLTextAreaElement;
    let descriptionProgress = DescriptionParser.progressOfDescription(description);

    function prepareSubtasks(node: HTMLElement) {
        const taskLines = descriptionTaskLines(description);
        const sourceItems = Array.from(node.querySelectorAll('li')).filter(li =>
            !li.closest('.internal-embed, [class*="block-language-"], .dataview'));
        const ownCheckbox = (li: HTMLElement) => Array.from(li.querySelectorAll<HTMLInputElement>(
            '.task-list-item-checkbox')).find(el => el.closest('li') === li);
        // Unknown postprocessors can add HTML checkboxes too. Never guess
        // source ownership when the rendered/source task counts disagree.
        const mappingValid = sourceItems.filter(li => ownCheckbox(li)).length === taskLines.length;
        let taskIndex = 0;
        sourceItems.forEach((liElement) => {
            liElement.style.color = 'var(--text-faint)';

            // the item's own checkbox: a direct child, or inside the <p> markdown-it
            // wraps loose-list items in; never a nested subtask's
            const checkbox = ownCheckbox(liElement);
            if (checkbox) {
                // Fragment rendering has no data-line. Map native task items
                // in document order to actual source list items, excluding
                // code blocks and embedded notes on both sides.
                const lineNumber = mappingValid ? taskLines[taskIndex++] : undefined;
                // mirror Obsidian's native task markup; themes key checkbox
                // styling off [data-task] (Cupertino masks checkboxes without it)
                liElement.setAttribute('data-task', checkbox.checked ? 'x' : ' ');
                checkbox.disabled = !interactive || lineNumber === undefined;
                checkbox.addEventListener('click', (evt) => {
                    // Own the source write; native preview delegation would
                    // interpret these description-relative lines as note lines.
                    evt.stopImmediatePropagation();
                    if (!interactive || lineNumber === undefined) return;
                    const newDescription = description.split('\n').map((line, index) => {
                        if (index !== lineNumber) {
                            return line;
                        }
                        return line.replace(/^((?:\s*>\s*)*\s*(?:[-*+]|\d+[.)])\s+\[).(\])/,
                            (_, prefix, suffix) => `${prefix}${checkbox.checked ? 'x' : ' '}${suffix}`);
                    });
                    description = newDescription.join('\n');
                    void taskSyncManager.updateObsidianTaskAttribute('description', description);
                }, true);
            }
        });
    }

    $: displayMarkdown = descriptionMarkdownForDisplay(
        description ?? '', get(SettingStore).parsingSettings.indicatorTag);

    async function enableEditMode(event: MouseEvent | KeyboardEvent) {
        if (isMarkdownControl(event)) return;
        event.stopPropagation();
        if ('key' in event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                taskSyncManager.taskCardStatus.descriptionStatus = 'editing';
                await tick();
                focusAndSelect(inputElement);
                adjustHeightForTextArea();
            }
        } else {
            taskSyncManager.taskCardStatus.descriptionStatus = 'editing';
            await tick();
            focusAndSelect(inputElement);
            adjustHeightForTextArea();
        }
    }

    // Uniform edit-mode contract (all card fields): Shift+Enter and focus
    // loss both commit (plain Enter stays a newline in this multi-line
    // editor); Escape is the only discard path. Unchanged values close the
    // editor without a file write.
    function commitEdit() {
        if (taskSyncManager.getTaskCardStatus('descriptionStatus') !== 'editing') return;
        taskSyncManager.taskCardStatus.descriptionStatus = 'done';
        if (description === (taskSyncManager.obsidianTask.description || '')) return;
        void taskSyncManager.updateObsidianTaskAttribute('description', description);
    }

    function cancelEdit() {
        if (taskSyncManager.getTaskCardStatus('descriptionStatus') !== 'editing') return;
        taskSyncManager.taskCardStatus.descriptionStatus = 'done';
        description = taskSyncManager.obsidianTask.description;
    }

    function finishEditing(event: KeyboardEvent) {
        if (event.shiftKey && event.key === 'Enter') {
            event.preventDefault();
            commitEdit();
        } else if (event.key === 'Escape') {
            cancelEdit();
        }
    }

    function adjustHeightForTextArea() {
        inputElement.style.height = 'auto';
        inputElement.style.height = `${inputElement.scrollHeight + 4}px`;
    }

    function focusAndSelect(node: HTMLTextAreaElement) {
        node.focus();
        node.select();
    }

    $: if (interactive && taskSyncManager.getTaskCardStatus('descriptionStatus') !== 'editing') {
        const sourceDescription = taskSyncManager.obsidianTask.description || '';
        if (sourceDescription !== description) {
            description = sourceDescription;
        }
    }

    $: descriptionProgress = DescriptionParser.progressOfDescription(description);

    $: {
        if (interactive) {
            displayDescription = description.trim().length > 0 || taskSyncManager.getTaskCardStatus('descriptionStatus') === 'editing';
        } else {
            displayDescription = description.trim().length > 0;
        }
    }
</script>

{#if displayDescription}
    <div class="task-card-description-wrapper">
        <!-- hidden while editing: the float would push the textarea down -->
        {#if showProgress && descriptionProgress[1] > 0 && !(interactive && taskSyncManager.getTaskCardStatus('descriptionStatus') === 'editing')}
            <div
                class="task-card-progress-row"
                aria-label="Subtask progress"
                title="{descriptionProgress[0]} of {descriptionProgress[1]} subtasks"
            >
                <div class="task-card-progress-track">
                    <div
                        class="task-card-progress-fill"
                        style="width: {(descriptionProgress[0] / descriptionProgress[1]) * 100}%"
                    />
                </div>
                <span class="task-card-progress-text">
                    {descriptionProgress[0]}/{descriptionProgress[1]}
                </span>
            </div>
        {/if}

        {#if interactive && taskSyncManager.getTaskCardStatus('descriptionStatus') === 'editing'}
            <textarea
                bind:value={description}
                on:keydown={interactive ? finishEditing : null}
                on:blur={interactive ? commitEdit : null}
                bind:this={inputElement}
                wrap="soft"
                placeholder="Type in Description. Shift+Enter or click away to save. Esc to cancel."
                title="Shift+Enter to save · Esc to cancel"
                class="task-card-description"
            ></textarea>
        {:else}
            <div 
                class="task-card-description" 
                role="button" 
                tabindex="0"
                on:click={interactive ? enableEditMode : null}
                on:keydown={interactive ? enableEditMode : null}
                use:taskMarkdown={{app: plugin?.app ?? taskSyncManager?.plugin?.app,
                  markdown: displayMarkdown, sourcePath: sourcePath ?? taskSyncManager?.taskMetadata?.sourcePath,
                  onRendered: prepareSubtasks}}
                aria-label="Description"
            >
            </div>
        {/if}
    </div>
{/if}

<style>

    /* slim subtask progress (pillar-3 refresh): track + count above the
       description, replacing the absolute-positioned circular overlay */
    .task-card-progress-row {
        display: flex;
        align-items: center;
        gap: 6px;
        /* inside the subtask block, top-right: floated before the description
           div (which is rebuilt via innerHTML, so it cannot live in it), so
           the first subtask row and any wrapped continuation flow around it.
           One subtask line tall so it centers on that row. */
        float: right;
        height: calc(var(--line-height-tight) * var(--font-smallest));
        margin: calc(0.1 * var(--font-smallest)) 0 0 8px;
    }

    .task-card-progress-track {
        width: 36px;
        height: 3px;
        border-radius: 2px;
        background-color: var(--background-modifier-border);
        overflow: hidden;
        flex-shrink: 0;
    }

    .task-card-progress-fill {
        height: 100%;
        background-color: var(--interactive-accent);
        border-radius: 2px;
    }

    .task-card-progress-text {
        font-size: var(--font-ui-smaller);
        color: var(--text-muted);
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
    }


    .task-card-description-wrapper {
        position: relative; /* Relative positioning for the wrapper */
        grid-column: 2;
        grid-row: 2;
        width: 100%;
        height: 100%;
    }

    .task-card-description {
        /* grid-column: 2;
        grid-row: 2; */
        font-size: var(--font-smallest);
        line-height: var(--line-height-tight);
        color: var(--text-faint);
        border-radius: var(--radius-s);
        cursor: pointer; /* Pointer cursor on hover */
        /* the title text has no left inset (styles.css), so the list starts at
           the column edge; the hover fill keeps 0.22em via an equal negative
           margin */
        margin: 0 0 0 calc(-0.22 * var(--font-smallest));
        padding: calc(0.1 * var(--font-smallest)) 0 calc(0.1 * var(--font-smallest))
            calc(0.22 * var(--font-smallest));
        word-wrap: break-word; /* To break words if too long */
        white-space: normal; /* To auto change lines */
    }

    /* subtask text is smaller than body text, so Obsidian's baseline
       checkbox alignment leaves the box riding above the line; center it on
       the text instead (top offset is reset in styles.css) */
    .task-card-description :global(.task-list-item-checkbox) {
        vertical-align: middle;
    }

    .task-card-description:hover {
    background-color: var(--background-primary-alt);
    }


    textarea.task-card-description {
        background-color: var(--background-primary-alt);
        width: 100%;
        height: 100%;
        border-radius: 5px;
        padding: 0.22em;
        word-wrap: break-word; /* To break words if too long */
        resize: vertical;
    }

</style>
