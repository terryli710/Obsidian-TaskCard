

<script lang="ts">
    import { MultipleAttributeTaskQuery } from "../query/cache";
    import { QuerySyncManager, TaskQueryOptions } from "../query/querySyncManager";
    import { logger } from "../utils/log";

    export let options: TaskQueryOptions;
    export let query: MultipleAttributeTaskQuery = {
        priorityQuery: [],
        projectQuery: [],
        labelQuery: [],
        completedQuery: [],
        dueDateTimeQuery: ['', ''],
        filePathQuery: '',
    };
    export let querySyncManager: QuerySyncManager;

    let selectedCompleted = [];
    let selectedPriority = [];

    function toggleSelected(type, value) {
        console.log(`toggleSelected: type = ${type}, value = ${value}`);
        let selectedArray;
        if (type === 'completed') {
            selectedArray = selectedCompleted;
            query.completedQuery = selectedArray;
        } else if (type === 'priority') {
            selectedArray = selectedPriority;
            query.priorityQuery = selectedArray;
        }

        const index = selectedArray.indexOf(value);
        if (index === -1) {
            selectedArray.push(value);
        } else {
            selectedArray.splice(index, 1);
        }
    }


    logger.debug(`queryEditor.svelte: query = ${JSON.stringify(query)}, options = ${JSON.stringify(options)}`);
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
        logger.debug(`queryEditor.svelte: query = ${JSON.stringify(query)}`);
        querySyncManager.updateTaskQueryToFile(query);
    }
</script>

<div class="form-container">
    <!-- Completed -->
    <div class="form-group">
        <label class="title-completed" for="completed">Completed:</label>
        <div id="completed" class="button-group">
            <button class="toggle-button {selectedCompleted.includes('Yes') ? 'selected' : ''}" on:click={() => toggleSelected('completed', 'yes')}>Yes</button>
            <button class="toggle-button {selectedCompleted.includes('No') ? 'selected' : ''}" on:click={() => toggleSelected('completed', 'no')}>No</button>
        </div>
    </div>

    <!-- Priority -->
    <div class="form-group">
        <label class="title-priority" for="priority">Priority:</label>
        <div id="priority" class="button-group">
            <button class="toggle-button {selectedPriority.includes(1) ? 'selected' : ''}" on:click={() => toggleSelected('priority', 1)}>High</button>
            <button class="toggle-button {selectedPriority.includes(2) ? 'selected' : ''}" on:click={() => toggleSelected('priority', 2)}>Medium</button>
            <button class="toggle-button {selectedPriority.includes(3) ? 'selected' : ''}" on:click={() => toggleSelected('priority', 3)}>Low</button>
            <button class="toggle-button {selectedPriority.includes(4) ? 'selected' : ''}" on:click={() => toggleSelected('priority', 4)}>None</button>
        </div>
    </div>

    <!-- Project -->
    <div class="form-group">
        <label for="project">Project:</label>
        <select id="project" multiple bind:value={query.projectQuery}>
            {#if options?.projectOptions && options.projectOptions.length > 0}
                {#each options.projectOptions as project}
                <option value={project}>{project.name}</option>
                {/each}
            {/if}
        </select>
    </div>

    <!-- Label -->
    <div class="form-group">
        <label for="label">Label:</label>
        <select id="label" multiple bind:value={query.labelQuery}>
            {#if options?.labelOptions && options.labelOptions.length > 0}
                {#each options.labelOptions as label}
                <option value={label}>{label}</option>
                {/each}
            {/if}
        </select>
    </div>

    <!-- Due Date Time -->
    <div class="form-group">
        <label for="dueDateTime">Due Date Time:</label>
        <input id="dueDateTime" type="text" placeholder="Time Picker Here" bind:value={query.dueDateTimeQuery} />
    </div>

    <!-- File Path -->
    <div class="form-group">
        <label for="filePath">File Path:</label>
        <input id="filePath" type="text" bind:value={query.filePathQuery} />
    </div>

    <!-- Save Button -->
    <div class="form-group">
        <button on:click={saveQuery}>Save</button>
    </div>
</div>


<style>
    /* General Styles */
    .form-container {
        width: 100%;
        max-width: 600px;
        margin: auto;
        padding: 20px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    .form-group {
        margin-bottom: 20px;
    }

    label {
        display: inline-block;
        margin-bottom: 8px;
        font-weight: bold;
    }

    /* Button Group Styles */
    .button-group {
        display: flex;
        gap: 10px;
    }

    .toggle-button {
        padding: 10px;
        border: 1px solid #ccc;
        border-radius: 20px;
        background: #f1f1f1;
        cursor: pointer;
        transition: background 0.3s ease;
    }

    .toggle-button.selected {
        background: #007bff;
        color: white;
    }

    /* Save Button Styles */
    .save-button {
        padding: 10px 20px;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }

    .save-button:hover {
        background-color: #0056b3;
    }

    .title-completed, .title-priority, .title-project, .title-label, .title-dueDateTime, .title-filePath {
        font-size: 1.2em;
        color: #333;
    }
</style>
