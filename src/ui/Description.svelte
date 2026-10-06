<script lang="ts">
    import { ObsidianTaskSyncManager } from '../taskModule/taskSyncManager';
    import { tick } from 'svelte';
    import { DescriptionParser } from '../taskModule/description';
    import { ObsidianTask } from "../taskModule/task";
    import { stripTaskSyntaxForDisplay } from '../taskModule/fieldSyntax';
    import { SettingStore } from '../settings';
    import { get } from 'svelte/store';

    var md = require('markdown-it');
    var taskLists = require('markdown-it-task-lists');
    const mdParser = md().use(taskLists);

    export let interactive: boolean = true;
    export let taskSyncManager: ObsidianTaskSyncManager = undefined;
    export let taskItem: ObsidianTask = undefined;
    export let displayDescription: boolean;

    let description = interactive ? taskSyncManager.obsidianTask.description : taskItem.description;
    let inputElement: HTMLTextAreaElement;
    let descriptionProgress = DescriptionParser.progressOfDescription(description);

    function renderDescriptionNode(node: HTMLElement, markdown: string) {
        node.innerHTML = '';
        if (!markdown || markdown.trim().length === 0) {
            return;
        }

        // subtasks are stored as full task lines; show them without the
        // indicator tag, inline fields and block id
        const indicatorTag = get(SettingStore).parsingSettings.indicatorTag;
        const displayMarkdown = markdown
            .split('\n')
            .map((line) => stripTaskSyntaxForDisplay(line, indicatorTag))
            .join('\n');
        const html = mdParser.render(displayMarkdown);
        const doc = new DOMParser().parseFromString(html, 'text/html');

        Array.from(doc.body.children).forEach((child) => {
            node.appendChild(child.cloneNode(true));
        });

        let realLineNumber = 1;
        node.querySelectorAll('li').forEach((liElement) => {
            liElement.setAttribute('data-real-line', realLineNumber.toString());
            liElement.style.color = 'var(--text-faint)';

            // the item's own checkbox: a direct child, or inside the <p> markdown-it
            // wraps loose-list items in; never a nested subtask's
            const checkbox = Array.from(
                liElement.querySelectorAll('.task-list-item-checkbox')
            ).find((el) => el.closest('li') === liElement) as HTMLInputElement | undefined;
            if (checkbox) {
                // mirror Obsidian's native task markup; themes key checkbox
                // styling off [data-task] (Cupertino masks checkboxes without it)
                liElement.setAttribute('data-task', checkbox.checked ? 'x' : ' ');
                checkbox.removeAttribute('disabled');
                checkbox.addEventListener('click', (evt) => {
                    evt.stopPropagation();
                    const lineNumber = Number(liElement.getAttribute('data-real-line'));
                    const newDescription = description.split('\n').map((line, index) => {
                        if (index !== lineNumber - 1) {
                            return line;
                        }
                        if (line.includes('- [x]')) {
                            return line.replace('- [x]', '- [ ]');
                        }
                        if (line.includes('- [ ]')) {
                            return line.replace('- [ ]', '- [x]');
                        }
                        return line;
                    });
                    description = newDescription.join('\n');
                    void taskSyncManager.updateObsidianTaskAttribute('description', description);
                });
            }

            realLineNumber++;
        });
    }

    function appendDescription(node: HTMLElement, markdown: string) {
        renderDescriptionNode(node, markdown);
        return {
            update(nextMarkdown: string) {
                renderDescriptionNode(node, nextMarkdown);
            }
        };
    }

    async function enableEditMode(event: MouseEvent | KeyboardEvent) {
        event.stopPropagation();
        if (event instanceof KeyboardEvent) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                taskSyncManager.taskCardStatus.descriptionStatus = 'editing';
                await tick();
                focusAndSelect(inputElement);
                adjustHeightForTextArea();
            }
        } else if (event instanceof MouseEvent) {
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
        {#if descriptionProgress[1] > 0 && !(interactive && taskSyncManager.getTaskCardStatus('descriptionStatus') === 'editing')}
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
                use:appendDescription={description}
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
