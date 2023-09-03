

<script lang="ts">
    import { MultipleAttributeTaskQuery } from "../query/cache";
    import { QuerySyncManager, TaskQueryOptions } from "../query/querySyncManager";
    import { logger } from "../utils/log";

    export let options: TaskQueryOptions;
    export let intialQuery: MultipleAttributeTaskQuery = {
        priorityQuery: [],
        projectQuery: [],
        labelQuery: [],
        completedQuery: [],
        dueDateTimeQuery: ['', ''],
        filePathQuery: '',
    };

    let query: MultipleAttributeTaskQuery = intialQuery;

    export let querySyncManager: QuerySyncManager;

    let numberOfToggles: number = 0;

    let priorityMapping = {
        1: 'High',
        2: 'Medium',
        3: 'Low',
        4: 'None'
    };

    // Function to save the query
    function saveQuery() {
        // Post-processing to convert empty arrays or strings to null
        for (const key in query) {
            if (Array.isArray(query[key]) && query[key].length === 0) {
                query[key] = null;
            } else if (typeof query[key] === 'string' && query[key].trim() === '') {
                query[key] = null;
            }
        }
        querySyncManager.updateTaskQueryToFile(query);
    }

    function toggleSelected(type, value, event) {
        // Check if the event is a "select event"
        if (!isSelectEvent(event)) { 
            return; 
        }
        numberOfToggles++;

        // Determine which query array to modify
        let selectedArray;
        if (type === 'completed') {
            selectedArray = query.completedQuery;
        } else if (type === 'priority') {
            selectedArray = query.priorityQuery;
        }

        // If the array is undefined, exit the function
        if (!selectedArray) {
            console.error("Invalid type provided:", type);
            return;
        }

        // Check if the value already exists in the array
        const index = selectedArray.indexOf(value);

        // Add or remove the value from the array
        if (index === -1) {
            selectedArray.push(value);
        } else {
            selectedArray.splice(index, 1);
        }

        // If the array is empty, clear the event target value (optional)
        if (selectedArray.length === 0) {
            event.target.value = '';
        }

        // Log for debugging
        logger.debug("Updated query:", query);
    }

    function isSelectedChoice(type, value) {
        logger.debug(`query.completedQuery.includes(value): ${query.completedQuery.includes(value)}`);
        if (type === 'completed') {
            return query.completedQuery.includes(value);
        } else if (type === 'priority') {
            return query.priorityQuery.includes(value);
        }
    }

    function isSelectEvent(event) {
        // return true if is mount click or "Enter" key
        return event.type === 'click' || event.key === 'Enter';
    }

</script>


<ul class="query-editor">
    <!-- Completed -->
    <li class="query-section">
        <div class="query-section-title">Completed:</div>
        <div class="fixed-choice-selections">
            <ul class="fixed-choice-list">
                <li class="fix-chioce-item">
                    <button 
                        class="fix-chioce-item" class:is-selected={isSelectedChoice('completed', true)}
                        on:click={(evt) => toggleSelected('completed', true, evt)}
                        on:keydown={(evt) => toggleSelected('completed', true, evt)}
                    >yes</button>
                </li>
                <li class="fix-chioce-item">
                    <button 
                        class="fix-chioce-item"
                        on:click={(evt) => toggleSelected('completed', false, evt)}
                        on:keydown={(evt) => toggleSelected('completed', false, evt)}
                    >no</button>
                </li>
            </ul>
        </div>
    </li>

    <!-- Priority -->
    <li class="query-section">
        <div class="query-section-title">Priority:</div>
        <div class="fixed-choice-selections">
            <ul class="fixed-choice-list">
                {#each [1, 2, 3, 4] as priority}
                    <li class="fix-chioce-item">
                        <button 
                            class="{query.priorityQuery.includes(priority) ? 'is-selected' : ''}"
                            on:click={(evt) => toggleSelected('priority', priority, evt)}
                            on:keydown={(evt) => toggleSelected('priority', priority, evt)}
                        >
                            {priorityMapping[priority]}
                        </button> 
                    </li>
                {/each}
            </ul>
        </div>
    </li>

    <!-- Project -->
    <li class="query-section">
        <div class="query-section-title">Project:</div>
        <div class="project-choice-selections">
            <ul class="project-choice-list">
                {#if options?.projectOptions && options.projectOptions.length > 0}
                    {#each options.projectOptions as project}
                    <li class="project-chioce-item">{project.name}</li>
                    {/each}
                {/if}
            </ul>
        </div>
    </li>

    <!-- Label -->
    <li class="query-section">
        <div class="query-section-title">Label:</div>
        <div class="label-choice-selections">
            <ul class="label-choice-list">
                {#if options?.labelOptions && options.labelOptions.length > 0}
                    {#each options.labelOptions as label}
                    <li class="label-chioce-item">{label}</li>
                    {/each}
                {/if}
            </ul>
        </div>
    </li>

    <li class="query-section">
        <div class="query-section-title">Due Date Time:</div>
        <div class="due-datetime-input-area">
            <div class="query-input-area">
                <input type="text" placeholder="Start Time" bind:value={query.dueDateTimeQuery[0]} />
                <input type="text" placeholder="End Time" bind:value={query.dueDateTimeQuery[1]} />
        </div>
    </li>

    <li class="query-section">
        <div class="query-section-title">File Path:</div>
        <div class="query-input-area">
            <input type="text" placeholder="File Path" bind:value={query.filePathQuery} />
        </div>
    </li>

    <class class="button-menu">
        <button on:click={saveQuery}>Save</button>
    </class>


</ul>



<style>
    .is-selected {
        background-color: blue;
    }
    
</style>
