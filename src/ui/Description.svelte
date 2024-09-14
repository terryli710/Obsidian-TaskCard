<script lang="ts">
    // import { marked } from 'marked';
    // marked.use({ mangle: false, headerIds: false, langPrefix: '' });
    import { logger } from "../utils/log";
    import { ObsidianTaskSyncManager } from '../taskModule/taskSyncManager';
    import { tick } from 'svelte';
    import { DescriptionParser } from '../taskModule/description';
    import CircularProgressBar from "../components/CircularProgressBar.svelte";
    import { ObsidianTask } from "../taskModule/task";

    export let interactive: boolean = true;
    export let taskSyncManager: ObsidianTaskSyncManager = undefined;
    export let taskItem: ObsidianTask = undefined;
    export let displayDescription: boolean;

    let description = interactive ? taskSyncManager.obsidianTask.description : taskItem.description;
    let descriptionElList = interactive ? DescriptionParser.extractListEls(taskSyncManager.taskItemEl) : []; 
    // Description currently doesn't work for static cards.
    let inputElement: HTMLTextAreaElement;
    let descriptionProgress = DescriptionParser.progressOfDescription(description)

    function appendDescription(el: HTMLElement) {

        // Initialize a counter for the "real" line numbers
        let realLineNumber = 1;

        // Iterate through each <li> element
        for (let i = 0; i < descriptionElList.length; i++) {
            const descriptionEl = descriptionElList[i];
            descriptionEl.querySelectorAll('li').forEach((liElement) => {
            // Check if the <li> element contains a task
            if (liElement.classList.contains('task-list-item')) {
                // Update the "real" data-line attribute
                liElement.setAttribute('data-real-line', realLineNumber.toString());

                liElement.style.color = 'var(--text-faint)';

                // Find the checkbox within this <li> element
                const checkbox = liElement.querySelector('.task-list-item-checkbox');

                // Add a click event listener to the checkbox
                checkbox.addEventListener('click', function(event) {
                    event.stopPropagation(); // Prevent event from bubbling up
                    const lineNumber = parseInt(liElement.getAttribute('data-real-line'));
                    // Log the "real" data-line when the checkbox is clicked
                    console.log('Real data-line:', lineNumber);
                    // toggle the ith line's task status "- [ ] " or "- [x]"
                    const newDescription = description.split('\n').map((line, index) => {
                        if (index === lineNumber - 1) {
                            if (line.includes('- [x]')) {
                                return line.replace('- [x]', '- [ ]');
                            } else if (line.includes('- [ ]')) {
                                return line.replace('- [ ]', '- [x]');
                            }
                        }
                        return line;
                    })

                    description = newDescription.join('\n');

                    taskSyncManager.updateObsidianTaskAttribute('description', description);
                });
            }

            // Increment the "real" line number counter
            realLineNumber++;
            });
            el.appendChild(descriptionEl);
        }
        
    }

    async function enableEditMode(event: MouseEvent | KeyboardEvent) {
        if (event instanceof KeyboardEvent) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                taskSyncManager.taskCardStatus.descriptionStatus = 'editing';
                await tick();
                focusAndSelect(inputElement);
                adjustHeightForTextArea();
            }
        } else if (event instanceof MouseEvent) {
            // Only enter edit mode if the click is not on a checkbox
            if (!(event.target as HTMLElement).classList.contains('task-list-item-checkbox')) {
                taskSyncManager.taskCardStatus.descriptionStatus = 'editing';
                await tick();
                focusAndSelect(inputElement);
                adjustHeightForTextArea();
            }
        }
    }

    function finishEditing(event: KeyboardEvent) {
        if (event.shiftKey && event.key === 'Enter') {
            event.preventDefault();  // Prevent browser's default save behavior
            taskSyncManager.taskCardStatus.descriptionStatus = 'done';
            // descriptionMarkdown = marked(description);
            taskSyncManager.updateObsidianTaskAttribute('description', description);
        } else if (event.key === 'Escape') {
            // Cancel editing, return to non-editing mode, and reset the description
            taskSyncManager.taskCardStatus.descriptionStatus = 'done';
            description = taskSyncManager.obsidianTask.description;
            // descriptionMarkdown = marked(description);
        }
    }

    function adjustHeightForTextArea() {
        inputElement.style.height = 'auto';
        inputElement.style.height = `${inputElement.scrollHeight + 4}px`;
    }

    function focusAndSelect(node: HTMLTextAreaElement) {
        // Focus on the input element
        node.focus();
        // Select all the content
        node.select();
    }

    $: {
        if (interactive) {
            displayDescription = taskSyncManager.obsidianTask.hasDescription() || taskSyncManager.getTaskCardStatus('descriptionStatus') === 'editing';
        } else {
            displayDescription = description.length > 0;
        }
    }


</script>

{#if displayDescription}
    <div class="task-card-description-wrapper">
        {#if descriptionProgress[1] * descriptionProgress[0] > 0 }
            <div class="task-card-progress-position">
                <CircularProgressBar value={descriptionProgress[0]} max={descriptionProgress[1]} />
            </div>
        {/if}

        {#if taskSyncManager.getTaskCardStatus('descriptionStatus') === 'editing'}
            <textarea 
                bind:value={description} 
                on:keydown={interactive ? finishEditing : null}
                bind:this={inputElement}
                wrap="soft"
                placeholder="Type in Description. Shift+Enter to Save. Esc to Cancel."
                class="task-card-description"
            ></textarea>
        {:else}
            <div 
                class="task-card-description" 
                role="button" 
                tabindex="0"
                on:click={interactive ? enableEditMode : null}
                on:keydown={interactive ? enableEditMode : null}
                use:appendDescription
                aria-label="Description"
            >
                <!-- {@html descriptionMarkdown} -->
            </div>
        {/if}
    </div>
{/if}