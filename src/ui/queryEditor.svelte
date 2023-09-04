

<script lang="ts">
    import { MultipleAttributeTaskQuery } from "../query/cache";
    import { QuerySyncManager, TaskQueryOptions } from "../query/querySyncManager";
    import { logger } from "../utils/log";
    import Calendar from './calendar/Calendar.svelte';
    import FixedOptionsSelect from "./selections/FixedOptionsSelect.svelte";
    import ProjectSelection from "./selections/ProjectSelection.svelte";
    import TagSelect from "./selections/TagSelect.svelte";
    import moment from 'moment';

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

    let startDate = new Date(query.dueDateTimeQuery[0]);
    let endDate = new Date(query.dueDateTimeQuery[1]);

    let startMoment = moment(startDate);
    let endMoment = moment(endDate);

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
        } else if (queryName === 'priority') {
            query.priorityQuery = selectedValues;
        } else if (queryName === 'label') {
            query.labelQuery = selectedValues;
        }
    }

    function handleDateSelection(event, queryName) {
        const selectedValue = event.detail;
        logger.debug(`Date selected value: ${selectedValue}`);
        if (queryName = 'startDate') {
            query.dueDateTimeQuery[0] = selectedValue;
        } else if (queryName = 'endDate') {
            query.dueDateTimeQuery[1] = selectedValue;
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
            <Calendar 
                displayedMonth={startMoment || undefined}
                on:selected={(evt) => handleDateSelection(evt, 'startDate')}
            />
            <Calendar 
                displayedMonth={endMoment || undefined}
                on:selected={(evt) => handleDateSelection(evt, 'endDate')}
            />
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
