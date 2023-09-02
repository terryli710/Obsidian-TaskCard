

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
        <label for="completed">Completed:</label>
        <select id="completed" multiple bind:value={query.completedQuery}>
            {#if options?.completedOptions && options.completedOptions.length > 0}
                {#each options.completedOptions as completed}
                <option value={completed}>{completed}</option>
                {/each}
            {/if}
        </select>
    </div>

    <!-- Priority -->
    <div class="form-group">
        <label for="priority">Priority:</label>
        <select id="priority" multiple bind:value={query.priorityQuery}>
            {#if options?.priorityOptions && options.priorityOptions.length > 0}
                {#each options.priorityOptions as priority}
                <option value={priority}>{priority}</option>
                {/each}
            {/if}
        </select>
    </div>

    <!-- Project -->
    <div class="form-group">
        <label for="project">Project:</label>
        <select id="project" multiple bind:value={query.projectQuery}>
            {#if options?.projectOptions && options.projectOptions.length > 0}
                {#each options.projectOptions as project}
                <option value={project}>{project}</option>
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

    select, input {
        width: 100%;
        padding: 10px;
        border: 1px solid #ccc;
        border-radius: 4px;
    }

    button {
        padding: 10px 20px;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }

    button:hover {
        background-color: #0056b3;
    }
</style>