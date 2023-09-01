

<script lang="ts">
    import { MultipleAttributeTaskQuery } from "../query/cache";
    import { QuerySyncManager, TaskQueryOptions } from "../query/querySyncManager";

    export let options: TaskQueryOptions;
    export let query: MultipleAttributeTaskQuery = {
        priorityQuery: null,
        projectQuery: null,
        labelQuery: null,
        completedQuery: null,
        dueDateTimeQuery: null,
        filePathQuery: null,
    };
    export let querySyncManager: QuerySyncManager;

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
</script>

<div>
    <!-- Completed -->
    <label>Completed:</label>
    <select multiple bind:value={query.completedQuery}>
        {#if options && options.completedOptions}
            {#each options.completedOptions as completed}
            <option value={completed}>{completed}</option>
            {/each}
        {/if}
    </select>

    <!-- Priority -->
    <label>Priority:</label>
    <select multiple bind:value={query.priorityQuery}>
        {#if options && options.priorityOptions}
            {#each options.priorityOptions as priority}
            <option value={priority}>{priority}</option>
            {/each}
        {/if}
    </select>

    <!-- Project -->
    <label>Project:</label>
    <select multiple bind:value={query.projectQuery}>
        {#if options && options.projectOptions}
            {#each options.projectOptions as project}
            <option value={project}>{project}</option>
            {/each}
        {/if}
    </select>

    <!-- Label -->
    <label>Label:</label>
    <select multiple bind:value={query.labelQuery}>
        {#if options && options.labelOptions}
            {#each options.labelOptions as label}
            <option value={label}>{label}</option>
            {/each}
        {/if}
    </select>

    <!-- Due Date Time -->
    <label>Due Date Time:</label>
    <input type="text" placeholder="Time Picker Here" bind:value={query.dueDateTimeQuery} />

    <!-- File Path -->
    <label>File Path:</label>
    <input type="text" bind:value={query.filePathQuery} />

    <!-- Save Button -->
    <button on:click={saveQuery}>Save</button>
</div>

<style>

</style>