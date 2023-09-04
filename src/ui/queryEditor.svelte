

<script lang="ts">
    import { MultipleAttributeTaskQuery } from "../query/cache";
    import { QuerySyncManager, TaskQueryOptions } from "../query/querySyncManager";
    import { logger } from "../utils/log";
    import FixedOptionsSelect from "./selections/FixedOptionsSelect.svelte";
    import ProjectSelection from "./selections/ProjectSelection.svelte";
    import TagSelect from "./selections/TagSelect.svelte";

    export let options: TaskQueryOptions;
    export let query: MultipleAttributeTaskQuery = {
        priorityQuery: [],
        projectQuery: [],
        labelQuery: [],
        completedQuery: [],
        dueDateTimeQuery: ['', ''],
        filePathQuery: '',
    };

    logger.debug(`query: ${JSON.stringify(query)}`);
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

        
    // Function to handle selection updates
    function handleSelection(event, queryName) {
        const selectedValues = event.detail;
        logger.debug(`Selected values: ${selectedValues}`);
        // Update the appropriate query based on queryName
        if (queryName === 'completed') {
            query.completedQuery = selectedValues;
        } else if (queryName === 'project') {
            query.projectQuery = selectedValues;
        }
    }

    // choices
    const completedChoices = [
        { value: true, displayText: 'Yes' }, 
        { value: false, displayText: 'No' }];

    const priorityChoices = [
        { value: 1, displayText: 'High' }, 
        { value: 2, displayText: 'Medium' }, 
        { value: 3, displayText: 'Low' }, 
        { value: 4, displayText: 'None' }
    ];

</script>


<ul class="query-editor">
    <!-- Completed -->
    <FixedOptionsSelect title="Completed" description="To include completed or uncompleted tasks" choices={completedChoices} initialChoices={query.completedQuery} on:selected={(evt) => handleSelection(evt, 'completed')} />

    <!-- Priority -->
    <FixedOptionsSelect title="Priority" description="To filter teh priority of the task" choices={priorityChoices} initialChoices={query.priorityQuery} on:selected={(evt) => handleSelection(evt, 'priority')} />

    <!-- Project -->
    <ProjectSelection title="Project" description="To filter by project" choices={options?.projectOptions} initialChoices={query.projectQuery} on:selected={(evt) => handleSelection(evt, 'project')} />

    <!-- Label -->
    <TagSelect title="Label" description="To filter by label" choices={options?.labelOptions} initialChoices={query.labelQuery} on:selected={(evt) => handleSelection(evt, 'label')} />


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
    
</style>
