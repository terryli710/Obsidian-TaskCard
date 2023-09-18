

<script lang="ts">
    import { MultipleAttributeTaskQuery } from "../query/cache";
    import { QuerySyncManager, TaskQueryOptions } from "../query/querySyncManager";
    import { logger } from "../utils/log";
    import FixedOptionsSelect from "./selections/FixedOptionsSelect.svelte";
    import ProjectSelection from "./selections/ProjectSelection.svelte";
    import TagSelect from "./selections/TagSelect.svelte";
    import Sugar from "sugar";
    import { filePathSuggest } from "../utils/filePathSuggester";

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
    export let paths: string[] = [];

    let startDate = query.dueDateTimeQuery[0] ? new Date(query.dueDateTimeQuery[0]) : null;
    let endDate = query.dueDateTimeQuery[1] ? new Date(query.dueDateTimeQuery[1]) : null;

    let startDateString = startDate? startDate.toLocaleString() : '';
    let endDateString = endDate? endDate.toLocaleString() : '';

    let filePath = query.filePathQuery;

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
        // switch to save mode
        querySyncManager.updateTaskQueryToFile(query, false);
    }

    function resetQuery() {
        query = {
            priorityQuery: [],
            projectQuery: [],
            labelQuery: [],
            completedQuery: [],
            dueDateTimeQuery: ['', ''],
            filePathQuery: '',
        };
        querySyncManager.updateTaskQueryToFile(query);
    }
        
    // Function to handle selection updates
    function handleSelection(event, queryName) {
        const selectedValues = event.detail;
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
        query.dueDateTimeQuery[0] = isValidDate(startDate) ? startDate.toLocaleString() : '';
        query.dueDateTimeQuery[1] = isValidDate(endDate) ? endDate.toLocaleString() : '';
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
        
        // if value is empty, set date to null
        if (value === '') {
            if (queryName === 'startDate') {
                startDate = null;
            } else if (queryName === 'endDate') {
                endDate = null;
            }
        }
        
        // Parse the date string
        const time = Sugar.Date.create(value);

        // Validate the parsed time
        if (!time || !isValidDate(time)) {
            // logger.error(`Invalid date string: ${value}`);
            return;
        }

        // Assign the parsed time to the appropriate variable
        if (queryName === 'startDate') {
            startDate = time;
        } else if (queryName === 'endDate') {
            endDate = time;
        }
    }

    function handleFilePathInput(event: any) {
        const matches = filePathSuggest(filePath, paths);
        if (matches.length > 0) {
            query.filePathQuery = matches[0];
        } else {
            query.filePathQuery = '';
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
        description="To filter the priority of the task" 
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
            <div class="input-wrapper">
                <div class="date-input-component">
                    <input id="startDateInput" 
                        type="text" placeholder="Enter start date" 
                        bind:value={startDateString}
                        on:input={(evt) => handleDateInput(evt, 'startDate')}
                    >
                    <span 
                        class="time-displayer {isValidDate(startDate) ? 'valid-date' : (startDateString ? 'invalid-date' : '')}"
                    >
                        {startDate ? startDate : (startDateString ? 'invalid date' : 'empty date')}
                    </span>
                </div>
                <div class="date-input-component">
                    <input id="endDateInput" 
                        type="text" placeholder="Enter end date" 
                        bind:value={endDateString}
                        on:input={(evt) => handleDateInput(evt, 'endDate')}
                    >
                    <span 
                        class="time-displayer {isValidDate(endDate) ? 'valid-date' : (endDateString ? 'invalid-date' : '')}"
                    >
                        {endDate ? endDate : (endDateString ? 'invalid date' : 'empty date')}
                    </span>
                </div>
            </div>
        </div>
    </li>

    <li class="query-section">
        <div class="header">
            <div class="inline-title-wrapper">
                <div class="inline-title">File Path</div>
                <div class="inline-description">Filter task in a file or folder</div>
            </div>
            <div class="input-wrapper">
                <div class="file-path-input-component">
                    <input 
                        class="file-path-input" 
                        type="text" 
                        placeholder="File/Folder Path" 
                        bind:value={filePath} 
                        on:input={(evt) => handleFilePathInput(evt)}
                    />
                    <span 
                        class="file-path-displayer {query.filePathQuery ? 'valid-path' : (filePath ? 'invalid-path' : '')}"
                    >
                        {query.filePathQuery ? query.filePathQuery : (filePath ? 'invalid path' : 'empty path')}
                </span>
                </div>
            </div>
        </div>
    </li>

    <div class="button-menu">
        <button class="save-button" on:click={saveQuery}>Save</button>
        <button class="reset-button" on:click={resetQuery}>Reset</button>
    </div>


</ul>



<style>

    .query-section {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
    }

    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        flex-grow: 1;
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
        flex-direction: row;
        align-items: flex-start;
        flex-grow: 1;
        background-color: var(--background-primary-alt);
        border-radius: 12px;
        padding: 15px;
        margin: 8px;
    }

    input {
        width: 100%;
        margin-bottom: 5px;
    }

    .time-displayer {
        color: var(--text-faint);
        font-size: calc(var(--font-ui-smaller) * 0.9);
        text-align: left;
        word-wrap: break-word;
        width: 100%;
    }

    .time-displayer.valid-date {
        color: var(--text-success);
    }

    .time-displayer.invalid-date {
        color: var(--text-error);
    }

    .date-input-component {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin: 0.5em;
        width: 55%;
    }

    .file-path-input-component {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin: 0.5em;
        width: 100%;
    }

    .file-path-input {
        width: 300px;
    }

    .file-path-displayer {
        color: var(--text-faint);
        font-size: calc(var(--font-ui-smaller) * 0.9);
        text-align: left;
        word-wrap: break-word;
        min-width: 300px;
    }

    .file-path-displayer.valid-path {
        color: var(--text-success);
    }

    .file-path-displayer.invalid-path {
        color: var(--text-error);
    }

    .button-menu {
        display: flex;
        justify-content: space-between;
        margin: 8px;
    }

    .save-button, .reset-button {
        width: 48%; /* Takes up nearly half the width, leaving a small gap in between */
        padding: 10px;
        font-size: 16px;
    }

    .reset-button {
        background-color: var(--color-red);
        color: var(--text-on-accent);
    }

    .save-button {
        color: var(--text-normal);
    }

</style>
