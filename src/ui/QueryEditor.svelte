

<script lang="ts">
    import { MultipleAttributeTaskQuery } from "../query/cache";
    import {
        normalizeQueryDisplayMode,
        QueryDisplayMode,
        QuerySyncManager,
        TaskQueryOptions
    } from "../query/querySyncManager";
    import { logger } from "../utils/log";
    import FixedOptionsMultiSelect from "./selections/FixedOptionsMultiSelect.svelte";
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
        scheduleDateTimeQuery: ['', ''],
        filePathQuery: '',
    };
    export let querySyncManager: QuerySyncManager;
    export let paths: string[] = [];

    let startDate = query.scheduleDateTimeQuery[0] ? new Date(query.scheduleDateTimeQuery[0]) : null;
    let endDate = query.scheduleDateTimeQuery[1] ? new Date(query.scheduleDateTimeQuery[1]) : null;

    let startDateString = startDate? startDate.toLocaleString() : '';
    let endDateString = endDate? endDate.toLocaleString() : '';

    let filePath = query.filePathQuery;
    let displayMode: QueryDisplayMode = querySyncManager.displayMode
        ?? normalizeQueryDisplayMode(querySyncManager.plugin.settings.displaySettings.queryDisplayMode);

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
        querySyncManager.displayMode = displayMode;
        querySyncManager.updateTaskQueryToFile(query, false);
    }

    function resetQuery() {
        query = {
            priorityQuery: [],
            projectQuery: [],
            labelQuery: [],
            completedQuery: [],
            scheduleDateTimeQuery: ['', ''],
            filePathQuery: '',
        };
        querySyncManager.displayMode = null;
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

    function handleDisplaySelection(event) {
        displayMode = event.detail;
    }

    function saveDate() {
        query.scheduleDateTimeQuery[0] = isValidDate(startDate) ? startDate.toLocaleString() : '';
        query.scheduleDateTimeQuery[1] = isValidDate(endDate) ? endDate.toLocaleString() : '';
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

    function isValidDateInput(value: string) {
        if (!value) {
            return false;
        }
        return isValidDate(Sugar.Date.create(value));
    }

    $: startDateInputIsValid = isValidDateInput(startDateString);
    $: endDateInputIsValid = isValidDateInput(endDateString);


    // choices
    const completedChoices = [
        { value: true, displayText: 'Yes' }, 
        { value: false, displayText: 'No' }];

    // spec scale (docs/format-spec.md): 1↔highest, 2↔high, 3↔medium, 4↔low/default
    const priorityChoices = [
        { value: 1, displayText: 'Highest' },
        { value: 2, displayText: 'High' },
        { value: 3, displayText: 'Medium' },
        { value: 4, displayText: 'Low' }
    ];

    const displayChoices = [
        { value: 'list', displayText: 'List' },
        { value: 'matrix', displayText: 'Matrix' }
    ];


</script>


<div class="query-editor">
    <div class="query-editor-header">
        <span class="query-editor-header-label">Query</span>
    </div>
    <FixedOptionsMultiSelect
        title="Completed"
        description="Include completed or uncompleted tasks"
        choices={completedChoices} 
        initialChoices={query.completedQuery} 
        on:selected={(evt) => handleSelection(evt, 'completed')} 
    />

    <FixedOptionsMultiSelect 
        title="Priority" 
        description="Filter by task priority"
        choices={priorityChoices} 
        initialChoices={query.priorityQuery} 
        on:selected={(evt) => handleSelection(evt, 'priority')} 
    />

    <ProjectSelection 
        title="Project" 
        description="Filter by project"
        choices={options?.projectOptions} 
        initialChoices={query.projectQuery} 
        on:selected={(evt) => handleSelection(evt, 'project')} 
    />

    <TagSelect 
        title="Label" 
        description="Filter by label"
        choices={options?.labelOptions} 
        initialChoices={query.labelQuery} 
        on:selected={(evt) => handleSelection(evt, 'label')} 
    />

    <div class="tc-query-row">
        <div class="tc-query-info">
            <div class="tc-query-name">Schedule date</div>
            <div class="tc-query-description">Natural language, e.g. "last monday"</div>
        </div>
        <div class="tc-query-control tc-query-control-stacked">
            <div class="date-inputs">
                <input
                    id="startDateInput"
                    type="text"
                    placeholder="Start"
                    bind:value={startDateString}
                    on:input={(evt) => handleDateInput(evt, 'startDate')}
                />
                <input
                    id="endDateInput"
                    type="text"
                    placeholder="End"
                    bind:value={endDateString}
                    on:input={(evt) => handleDateInput(evt, 'endDate')}
                />
            </div>
            <div class="query-preview">
                <span
                    class:valid={startDateInputIsValid}
                    class:invalid={!startDateInputIsValid && !!startDateString}
                    class:empty={!startDateString}
                >{startDateInputIsValid && startDate ? startDate.toLocaleString() : (startDateString ? 'invalid date' : '—')}</span>
                →
                <span
                    class:valid={endDateInputIsValid}
                    class:invalid={!endDateInputIsValid && !!endDateString}
                    class:empty={!endDateString}
                >{endDateInputIsValid && endDate ? endDate.toLocaleString() : (endDateString ? 'invalid date' : '—')}</span>
            </div>
        </div>
    </div>

    <div class="tc-query-row">
        <div class="tc-query-info">
            <div class="tc-query-name">File path</div>
            <div class="tc-query-description">Limit to a file or folder</div>
        </div>
        <div class="tc-query-control tc-query-control-stacked">
            <input
                class="file-path-input"
                type="text"
                placeholder="File or folder"
                bind:value={filePath}
                on:input={(evt) => handleFilePathInput(evt)}
            />
            <div class="query-preview">
                <span
                    class:valid={!!query.filePathQuery}
                    class:invalid={!query.filePathQuery && !!filePath}
                    class:empty={!filePath}
                >{query.filePathQuery ? query.filePathQuery : (filePath ? 'invalid path' : '—')}</span>
            </div>
        </div>
    </div>

    <FixedOptionsSelect
        title="Display"
        description="How results are shown"
        choices={displayChoices}
        initialChoice={displayMode}
        on:selected={handleDisplaySelection}
    />

    <div class="query-footer">
        <button type="button" class="reset-button" on:click={resetQuery}>Reset</button>
        <button type="button" class="save-button" on:click={saveQuery}>Save</button>
    </div>
</div>



<style>
    .query-editor {
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    /* mirrors .query-header in QueryDisplay; the empty right half keeps the
       Live Preview edit-block button off the form controls */
    .query-editor-header {
        display: flex;
        align-items: baseline;
        padding: 0 2px 6px;
    }

    .query-editor-header-label {
        font-size: 11px;
        font-weight: 600;
        color: var(--text-faint);
        text-transform: uppercase;
        letter-spacing: 0.08em;
    }

    .query-editor :global(.tc-query-row) {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding: 9px 2px;
        min-width: 0;
    }

    .query-editor :global(.tc-query-row + .tc-query-row) {
        border-top: 1px solid var(--background-modifier-border);
    }

    .query-editor :global(.tc-query-info) {
        flex: 1 1 auto;
        min-width: 0;
    }

    .query-editor :global(.tc-query-name) {
        font-size: var(--font-ui-small);
        color: var(--text-normal);
        line-height: var(--line-height-tight);
    }

    .query-editor :global(.tc-query-description) {
        font-size: var(--font-ui-smaller);
        color: var(--text-muted);
        padding-top: 2px;
        line-height: var(--line-height-tight);
    }

    .query-editor :global(.tc-query-control) {
        flex: 0 1 58%;
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        justify-content: flex-end;
        align-items: center;
        min-width: 0;
    }

    .query-editor :global(.tc-query-control-stacked) {
        flex-direction: column;
        align-items: flex-end;
    }

    .query-editor :global(.tc-query-chip) {
        height: 21px;
        padding: 0 10px;
        border-radius: 11px;
        box-shadow: none;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: var(--font-ui-smaller);
        line-height: 1;
        background: transparent;
        border: 1px solid var(--background-modifier-border);
        color: var(--text-muted);
        cursor: pointer;
        max-width: 100%;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .query-editor :global(.tc-query-chip:hover) {
        background: var(--background-modifier-hover);
    }

    .query-editor :global(.tc-query-chip.selected) {
        background: color-mix(in srgb, var(--text-accent) 14%, transparent);
        border-color: color-mix(in srgb, var(--text-accent) 40%, transparent);
        color: var(--text-accent);
    }

    .query-editor :global(.tc-query-project-dot) {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .date-inputs {
        display: flex;
        gap: 6px;
        width: 262px;
        max-width: 100%;
        min-width: 0;
    }

    .date-inputs input {
        box-sizing: border-box;
        flex: 1 1 128px;
        width: 128px;
        max-width: 100%;
        min-width: 0;
    }

    .file-path-input {
        box-sizing: border-box;
        width: 262px;
        max-width: 100%;
        min-width: 0;
    }

    .query-preview {
        max-width: 100%;
        min-width: 0;
        padding-top: 3px;
        color: var(--text-faint);
        font-size: var(--font-ui-smaller);
        text-align: right;
        overflow-wrap: anywhere;
    }

    .query-preview .valid {
        color: var(--color-green);
    }

    .query-preview .invalid {
        color: var(--text-error);
    }

    .query-preview .empty {
        color: var(--text-faint);
    }

    .query-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 12px 2px 2px;
        border-top: 1px solid var(--background-modifier-border);
        margin-top: -1px;
    }

    .reset-button {
        background: transparent;
        border: none;
        box-shadow: none;
        color: var(--text-muted);
    }

    .reset-button:hover {
        color: var(--text-normal);
        background: var(--background-modifier-hover);
    }

    .save-button {
        background: var(--interactive-accent);
        border-color: var(--interactive-accent);
        color: var(--text-on-accent);
    }
</style>
