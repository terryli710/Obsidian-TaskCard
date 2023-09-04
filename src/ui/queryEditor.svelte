

<script lang="ts">
    import { MultipleAttributeTaskQuery } from "../query/cache";
    import { QuerySyncManager, TaskQueryOptions } from "../query/querySyncManager";
    import { logger } from "../utils/log";
    import FixedOptionsSelect from "./selections/FixedOptionsSelect.svelte";
    import ProjectSelection from "./selections/ProjectSelection.svelte";
    import TagSelect from "./selections/TagSelect.svelte";
    import Sugar from "sugar";

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

    let startDate = query.dueDateTimeQuery[0] ? new Date(query.dueDateTimeQuery[0]) : new Date();
    let endDate = query.dueDateTimeQuery[1] ? new Date(query.dueDateTimeQuery[1]) : new Date();

    let startDateString = startDate.toLocaleString();
    let endDateString = endDate.toLocaleString();

    // Function to save the query
    function saveQuery() {
        saveDate();
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
        } else if (queryName === 'priority') {
            query.priorityQuery = selectedValues;
        } else if (queryName === 'label') {
            query.labelQuery = selectedValues;
        }
    }

    function saveDate() {
        query.dueDateTimeQuery[0] = startDate.toLocaleString();
        query.dueDateTimeQuery[1] = endDate.toLocaleString();
    }

    function isValidDate(date: Date) {
        return date instanceof Date && !isNaN(date.getTime());
    }

    function handleDateInput(event: any, queryName: 'startDate' | 'endDate') {
        // Validate queryName
        if (!['startDate', 'endDate'].includes(queryName)) {
            return;
        }

        // Determine the value based on queryName
        const value = queryName === 'startDate' ? startDateString : endDateString;

        // Parse the date string
        const time = Sugar.Date.create(value);

        // Validate the parsed time
        if (!time || !isValidDate(time)) {
            logger.error(`Invalid date string: ${value}`);
            return;
        }

        // Assign the parsed time to the appropriate variable
        if (queryName === 'startDate') {
            startDate = time;
        } else {
            endDate = time;
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
    <FixedOptionsSelect 
        title="Completed" 
        description="To include completed or uncompleted tasks" 
        choices={completedChoices} 
        initialChoices={query.completedQuery} 
        on:selected={(evt) => handleSelection(evt, 'completed')} 
    />

    <!-- Priority -->
    <FixedOptionsSelect 
        title="Priority" 
        description="To filter teh priority of the task" 
        choices={priorityChoices} 
        initialChoices={query.priorityQuery} 
        on:selected={(evt) => handleSelection(evt, 'priority')} 
    />

    <!-- Project -->
    <ProjectSelection 
        title="Project" 
        description="To filter by project" 
        choices={options?.projectOptions} 
        initialChoices={query.projectQuery} 
        on:selected={(evt) => handleSelection(evt, 'project')} 
    />

    <!-- Label -->
    <TagSelect 
        title="Label" 
        description="To filter by label" 
        choices={options?.labelOptions} 
        initialChoices={query.labelQuery} 
        on:selected={(evt) => handleSelection(evt, 'label')} 
    />

    <!-- Due DateTime -->
    <li class="query-section">
        <div class="header">
            <div class="inline-title-wrapper">
                <div class="inline-title">Due Date</div>
                <div class="inline-description">To filter by due date</div>
            </div>
            <div class="separator"></div>
            <div class="input-wrapper">
                <input id="startDateInput" 
                    type="text" placeholder="Enter start date" 
                    bind:value={startDateString}
                    on:input={(evt) => handleDateInput(evt, 'startDate')}
                >
                <span class="time-displayer">{startDate}</span>
            </div>
            <div class="input-wrapper">
                <input id="endDateInput" 
                    type="text" placeholder="Enter end date" 
                    bind:value={endDateString}
                    on:input={(evt) => handleDateInput(evt, 'endDate')}
                >
                <span class="time-displayer">{endDate}</span>
            </div>
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

    .query-section {
        display: flex;
        flex-direction: column;
    }

    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .inline-title-wrapper {
        flex: 0 0 30%;
        margin: 0;
        padding: 0;
        line-height: 1.5;
        font-size: 1.2em;
        text-align: left;
        display: flex;
        flex-direction: column;
    }

    .inline-title {
        color: var(--text-normal);
        font-size: var(--font-ui-medium);
        line-height: var(--line-height-tight);
    }

    .inline-description {
        color: var(--text-muted);
        font-size: var(--font-ui-smaller);
        padding-top: var(--size-4-1);
        line-height: var(--line-height-tight);
    }

    .input-wrapper {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
    }

    input {
        width: 100%;
        margin-bottom: 5px;
    }

    .time-displayer {
        color: gray;
        font-size: 0.8em;
        text-align: left;
        word-wrap: break-word;
    }


</style>
