// Adopted from https://github.com/YukiGasai/obsidian-google-calendar/tree/master/src/googleApi

import { Notice } from "obsidian";
import { logger } from "../../utils/log";
import { GoogleCalendarAuthenticator } from "./authentication";
import { callRequest } from "./requestWrapper";
import { GoogleCalendar, GoogleEvent, GoogleEventList, GoogleEventTimePoint } from "./types";
import moment from "moment";
import { SettingStore } from "../../settings";
import { GoogleApiError } from "./googleAPIError";
import { TaskChangeEvent, TaskChangeType } from "../../taskModule/taskAPI";
import { ObsidianTask } from "../../taskModule/task";
import { GoogleSyncSetting } from "../../settings/syncSettings/googleCalendarSettings";


export class GoogleCalendarAPI { 

    public authenticator: GoogleCalendarAuthenticator;
    public calendars: GoogleCalendar[];
    public defaultCalendar: GoogleCalendar;
    private lastUpdateCalenderTime: moment.Moment = null;
    updateThreshold: number;
    googleSyncSetting: GoogleSyncSetting;
    // private taskMappingDB: LocalStorageDB;

    constructor(updateThreshold: number = 1000 * 60 * 5) {
        this.authenticator = new GoogleCalendarAuthenticator();
        this.updateThreshold = updateThreshold;
        this.init();
        // setTimeout(() => {
        //     this.test();
        // }, 2000);
        // this.taskMappingDB = new LocalStorageDB("taskMapping");
    }

    async init() {
        try {
            this.calendars = await this.listCalendars();
        } catch (e) {
            logger.error(`Failed to list calendars: ${e}`);
            return;
        }
        SettingStore.subscribe((settings) => {
            const defaultCalendarId = settings.syncSettings.googleSyncSetting.defaultCalendarId;
            if (defaultCalendarId) {
                this.defaultCalendar = this.calendars.find(calendar => calendar.id === defaultCalendarId);
            }
            this.googleSyncSetting = settings.syncSettings.googleSyncSetting;
        });

    }

    async handleLocalTaskCreation(event: TaskChangeEvent): Promise<string> {
        if (event.type !== TaskChangeType.ADD) return '';
        if (this.filterCreationEvent(event) === false) return '';

        const googleEvent = this.convertTaskToGoogleEvent(event.currentState);
        const createdEvent = await this.createEvent(googleEvent);
        return createdEvent.id;
    }

    filterCreationEvent(event: TaskChangeEvent): boolean {
        // logic to filter creation events: some events should not be created by google calendar
        // 1. intrinsic filter: task without schedule date won't be created
        if (!event.currentState.schedule?.date) return false; // Optional chaining is used here
        // 2. setting based filter: if there's filter project or tag, check if the task is in the project or tag
        if (this.googleSyncSetting.doesNeedFilters && this.googleSyncSetting.filterProject) {
            if (this.googleSyncSetting.filterProject !== event.currentState.project?.id) return false;
        }
        if (this.googleSyncSetting.doesNeedFilters && this.googleSyncSetting.filterTag) {
            if (!event.currentState.labels?.includes(this.googleSyncSetting.filterTag)) return false;
        }
        return true;
    }

    async handleLocalTaskUpdate(event: TaskChangeEvent): Promise<string> {
        // local task updates can match to task update, create, or delete
        if (event.type !== TaskChangeType.UPDATE) return '';
        logger.debug(`handling local task update: ${JSON.stringify(event)}`);
        logger.debug(`has google sync id: ${event.currentState.metadata.syncMappings.googleSyncSetting?.id}`);
        logger.debug(`filtered: ${this.filterCreationEvent(event)}`);
        const googleEvent = this.convertTaskToGoogleEvent(event.currentState);
        
        // possible task creation events: 1. no google sync id 2. filter passed
        if (!event.currentState.metadata.syncMappings.googleSyncSetting?.id) {
            if (this.filterCreationEvent(event) === false) return '';
            logger.debug(`try to create event`)
            const createdEvent = await this.createEvent(googleEvent);
            return createdEvent?.id || '';
        }
        // possible task deletion events: 1. has google sync id; 2. filter failed
        if (event.previousState.metadata.syncMappings.googleSyncSetting?.id && !this.filterCreationEvent(event)) {
            logger.debug(`try to delete event`)
            const deletedEvent = await this.deleteEvent(googleEvent);
            return '';
        }
        // possible task update events: 1. has google sync id; 2. filter passed
        if (event.previousState.metadata.syncMappings.googleSyncSetting?.id && this.filterCreationEvent(event)) {
            logger.debug(`try to update event`)
            const updatedEvent = await this.updateEvent(googleEvent);
            return updatedEvent?.id || '';
        }
        return '';
    }

    async handleLocalTaskDeletion(event: TaskChangeEvent): Promise<void> {
        if (event.type !== TaskChangeType.REMOVE) return;
        if (!event.previousState.metadata.syncMappings.googleSyncSetting.id) return;

        const googleEvent = this.convertTaskToGoogleEvent(event.previousState);
        await this.deleteEvent(googleEvent);
    }

    convertTaskToGoogleEvent(task: Partial<ObsidianTask>): GoogleEvent {
        const {start, end} = this.constructStartAndEnd(task);
        const storedId = task.metadata?.syncMappings?.googleSyncSetting?.id;
        const event: GoogleEvent = {
            ...(storedId && { id: storedId }),
            summary: task.content,
            description: task.description,
            start: start,
            end: end,
        }
        return event
    }

    constructStartAndEnd(task: Partial<ObsidianTask>): {start: GoogleEventTimePoint, end: GoogleEventTimePoint} {
        if (!task.schedule) {
            logger.error(`Task has no schedule date: ${JSON.stringify(task)}`);
            return {start: {}, end: {}}
        }

        const schedule = task.schedule;
        const duration = task.duration || { hours: 0, minutes: 0 }; // Default duration if not provided

        // Format start date and time
        let startDateTime: string | null = null;
        if (schedule.time) {
            // Combine date and time if time is provided
            startDateTime = this.dateTimeToGoogleDateTime(`${schedule.date}T${schedule.time}`);
        }

        const start: GoogleEventTimePoint = {
            ...(startDateTime ? { dateTime: startDateTime } : { date: this.dateToGoogleDate(schedule.date) }),
            timeZone: schedule.timezone || this.defaultCalendar.timeZone || null,
        };

        // Calculate the end time based on the duration
        const taskDuration = moment.duration({ hours: duration.hours, minutes: duration.minutes });
        const endMoment = moment(startDateTime || schedule.date).add(taskDuration); // If time is not available, it assumes the start of the day

        // Check if duration is longer than one day
        const isMultiDay = taskDuration.asDays() >= 1;

        // Determine end date format based on whether time is specified and if duration is less than one day
        const endDateFormat = (schedule.time && !isMultiDay) ? "YYYY-MM-DDTHH:mm:ss" : "YYYY-MM-DD";

        const end: GoogleEventTimePoint = {
            ...(startDateTime ? { dateTime: endMoment.format(endDateFormat) } : { date: endMoment.format("YYYY-MM-DD") }),
            timeZone: schedule.timezone || this.defaultCalendar.timeZone || null,
        };

        return { start, end };
    }


    public async getCalendars(): Promise<GoogleCalendar[]> {

        // If 'this.calendars' is not initialized or the last update is old, refresh 'this.calendars'.
        if (!this.calendars || 
            !this.lastUpdateCalenderTime || 
            moment().diff(this.lastUpdateCalenderTime) > this.updateThreshold) {
            await this.refreshCalendars();
        }

        return this.calendars!;
    }

    async listCalendars(): Promise<GoogleCalendar[]> {
        if (!this.authenticator.isLogin) {
            console.warn(`[TaskCard] Not logged in to Google Calendar`);
            return [];
        }

        try {
            const calendarList = await callRequest(
                `https://www.googleapis.com/calendar/v3/users/me/calendarList`, 
                "GET", null);
            
            return calendarList.items;
        } catch (error) {
            console.error('Error listing calendars:', error);
            throw error; // Rethrowing error since it should be handled in the calling context.
        }
    }

    private async refreshCalendars(): Promise<void> {
        try {
            this.calendars = await this.listCalendars();
            this.lastUpdateCalenderTime = moment();
        } catch (error) {
            console.error('Failed to refresh calendars', error); // Handle errors appropriately for your context.
            // Potentially throw the error so it can be handled upstream or set 'this.calendars' to an empty array or null, based on how you want your application to behave on failure.
        }
    }

    async listEventsInCalendar(
            calendar: GoogleCalendar, 
            startDate: moment.Moment | null = null,
            endDate: moment.Moment | null = null,
            resultSize: number = 2500
        ): Promise<GoogleEvent[]> {

        if (!this.authenticator.isLogin) {
            new Notice(`[TaskCard] Not logged in to Google Calendar`);
            return [];
        }
        // preprocess startDate and endDate
        // 1. make sure that they are not null - startDate = start of today, endDate = end of the start day
        let startDateMoment: moment.Moment;
        let endDateMoment: moment.Moment;
        if (startDate) {
            startDateMoment = startDate;
        } else {
            startDateMoment = window.moment().startOf("day");
        }
        if (endDate) {
            endDateMoment = endDate;
        } else {
            endDateMoment = startDateMoment.endOf("day");
        }

        // Convert moments to ISO strings as required by the Google Calendar API
        const startString = startDateMoment.toISOString();
        const endString = endDateMoment.toISOString();

        // 2. Prepare for the request
        let totalEventList: GoogleEvent[] = [];
        let nextPageToken: string | undefined;

        do {
            let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?`;
            url += `maxResults=${resultSize}`;
            url += `&singleEvents=true`;
            url += `&orderBy=startTime`;
            url += `&timeMin=${startString}`;
            url += `&timeMax=${endString}`;

            if (nextPageToken) {
                url += `&pageToken=${nextPageToken}`;
            }

            // Make the API request
            const tmpRequestResult: GoogleEventList = await callRequest(url, "GET", null);

            // Filter events and assign the calendar as the parent to each event
            const newList = tmpRequestResult.items.filter((event) => {
                event.parent = calendar;
                return event.status !== "cancelled";
            });

            totalEventList = [...totalEventList, ...newList];

            // Prepare for the next iteration if necessary
            nextPageToken = tmpRequestResult.nextPageToken;
        } while (nextPageToken && totalEventList.length < resultSize); 

        return totalEventList;
    }

    
    /**
     * Method to get information of a single event by id
     * @param eventId The id of the event
     * @param calendarId The id of the calendar the event is in (optional)
     * @returns The found Event
     */
    
    async getEvent(eventId: string, calendarId?: string): Promise<GoogleEvent> {
        // Check if the settings are complete and the user is logged in
        if (!this.authenticator.isLogin) {
            new Notice(`[TaskCard] Not logged in to Google Calendar`);
            return null;
        }
        
        const calendars = await this.listCalendars();
        if (calendarId) {
            // Encode the calendarId before using it in the URL
            const encodedCalendarId = encodeURIComponent(calendarId);
            const foundEvent = await callRequest(`https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events/${eventId}`, "GET", null);
            foundEvent.parent = calendars.find(calendar => calendar.id === calendarId);
            return foundEvent;
        }

        // If calendar ID is not provided, attempt to find the event in all available calendars
        for (const calendar of calendars) {
            try {
                // Encode the calendar.id before using it in the URL
                const encodedCalendarId = encodeURIComponent(calendar.id);
                const foundEvent = await callRequest(`https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events/${eventId}`, "GET", null);
                if (foundEvent && foundEvent.id === eventId) {
                    foundEvent.parent = calendar;
                    return foundEvent;
                }
            } catch (err) {
                // If the event is not found in the current calendar, continue to the next one
                // Optionally, you might want to handle or log the error depending on your requirements
            }
        }

        // If the event was not found in any of the calendars, throw an error or handle it as per your requirement
        throw new Error('Event not found in any of the calendars');
    }


    async createEvent(event: Partial<GoogleEvent>, calendar?: GoogleCalendar): Promise<GoogleEvent | null> {
        if (!this.authenticator.isLogin) {
            new Notice(`[TaskCard] Not logged in to Google Calendar`);
            return null;
        }

        // Find the target calendar
        let targetCalendar: GoogleCalendar = event.parent || calendar || this.defaultCalendar;
        if (!targetCalendar) {
            new Notice(`[TaskCard] Could not create Google Event because no calendar was specified.`);
            return null;
        }

        // Preprocess the event
        logger.debug(`event: ${JSON.stringify(event)}`);
        const processedEvent = this.preprocessEvent(event, targetCalendar);
        logger.debug(`processedEvent: ${JSON.stringify(processedEvent)}`);

        try {
            // Assuming callRequest is accessible here, either as a global function or a method on this class.
            const createdEvent = await callRequest(
                `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendar.id)}/events?conferenceDataVersion=1`, 
                'POST', processedEvent);
            
            logger.info(`Google Event \"${event.summary}\" created (ID: ${createdEvent.id}).`);

            return createdEvent;
        } catch (error) {
            if (error instanceof GoogleApiError) {
                new Notice(`[TaskCard] ${error.message}`);
            } else {
                new Notice(`[TaskCard] Google event ${event.summary} could not be created.`);
                console.error('[GoogleCalendar]', error);
            }
            return null;
        }
    }


    /**
     * Deletes an event from Google Calendar. If the event is recurrent, it will delete all instances unless deleteSingle is set.
     * This method has been optimized for better readability, logical flow, and robustness.
     *
     * @param event The event to delete
     * @param deleteAllOccurrences If set to true and the event is recurrent, only one instance is deleted
     * @returns a promise that resolves with a boolean indicating whether the deletion was successful
     */
    async deleteEvent(event: GoogleEvent, deleteAllOccurrences: boolean = false): Promise<boolean> {
        try {
            if (!this.authenticator.isLogin) {
                new Notice(`[TaskCard] Not logged in to Google Calendar`);
                return null;
            }

            let calendarId = event.parent?.id ?? this.defaultCalendar?.id;

            if (!calendarId) {
                // No calendar ID found
                throw new GoogleApiError("No default calendar selected in settings", null, 999, { error: "No calendar set" });
            }

            // If the event is part of a recurrence and we're not deleting all occurrences,
            // we use the event ID; otherwise, we try to use the recurringEventId or default to the event ID.
            const eventId = (!deleteAllOccurrences && event.recurringEventId) ? event.id : (event.recurringEventId ?? event.id);

            // Send the DELETE request to the Google Calendar API
            const response = await callRequest(
                `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`, 
                'DELETE', null);

            if (response) {  // if needed, check specific response status or content
                new Notice(`[TaskCard] Google Event ${event.summary} deleted.`);
                return true;
            } else {
                throw new Error('Unknown error occurred.'); // or handle specific response error
            }

        } catch (error) {
            // Handling different types of errors and providing user feedback
            if (error instanceof GoogleApiError) {
                switch (error.status) {
                    case 401: // Unauthorized
                        // Handle the unauthorized error, e.g., by prompting re-login or giving a specific message
                        break;
                    case 999: // Custom error for "No calendar set"
                        new Notice(error.message); // Informing the user to select a default calendar
                        break;
                    default:
                        // Handle other types of API errors
                        new Notice(`Google Event ${event.summary} could not be deleted.`);
                        console.error('[TaskCard]', error);
                        break;
                }
            } else {
                // For unexpected errors, log them
                console.error('[TaskCard]', error);
            }
            return false; // Deletion failed
        }
    }


    /**
     * Updates an event in the user's Google Calendar.
     * If the event is recurrent, it will update all instances unless `updateSingle` is set to true.
     * In case of errors, a more robust approach is to delete and re-create the event.
     * 
     * @param {GoogleEvent} event - The event to update, along with the new data.
     * @param {boolean} updateAllOccurrences - If true and the event is recurrent, all instances are updated.
     * @returns {Promise<GoogleEvent|null>} - The updated event, or null if the update failed.
     */
    async updateEvent(event, updateAllOccurrences = false) {
        try {
            if (!this.authenticator.isLogin) {
                new Notice(`[TaskCard] Not logged in to Google Calendar`);
                return null;
            }

            // If updating a recurring event, retrieve the master event first
            if (updateAllOccurrences && event.recurringEventId) {
                const recurringEvent = await this.getEvent(event.recurringEventId, event.parent.id);
                event = this.prepareRecurringEventUpdate(event, recurringEvent);
            }

            const calendarId = this.determineCalendarId(event);
            if (!calendarId) {
                throw new GoogleApiError("No default calendar selected in settings", null, 999, {error: "No calendar set"});
            }

            const requestUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${event.id}`;
            const updatedEvent = await callRequest(requestUrl, "PUT", event);

            updatedEvent.parent = this.getCalendarParent(calendarId);

            new Notice(`[TaskCard] Google Event ${event.summary} updated.`);
            return updatedEvent;
        } catch (error) {
            return this.handleUpdateEventError(error, event);
        }
    }


    /**
     * Prepares a recurring event for an update operation.
     *
     * @param {GoogleEvent} event - The single instance of the recurring event with updates.
     * @param {GoogleEvent} recurringEvent - The master recurring event.
     * @returns {GoogleEvent} - The prepared event object ready for the update operation.
     */
    prepareRecurringEventUpdate(event, recurringEvent) {
        // Merge the event updates into the recurring event
        const updatedRecurringEvent = {
            ...recurringEvent,
            ...event,
            start: this.formatEventDate(event.start, recurringEvent.start),
            end: this.formatEventDate(event.end, recurringEvent.end),
            recurrence: recurringEvent.recurrence,
            id: recurringEvent.id
        };

        delete updatedRecurringEvent.recurringEventId;
        delete updatedRecurringEvent.originalStartTime;

        return updatedRecurringEvent;
    }

    /**
     * Formats the event date for consistency.
     *
     * @param {Object} eventDate - The event date object from the single event instance.
     * @param {Object} recurringEventDate - The event date object from the master recurring event.
     * @returns {Object} - The formatted event date object.
     */
    formatEventDate(eventDate, recurringEventDate) {
        const formattedDate = eventDate.dateTime
            ? { dateTime: window.moment(eventDate.dateTime).date(window.moment(recurringEventDate.dateTime).date()).format() }
            : { date: window.moment(recurringEventDate.date).format("YYYY-MM-DD") };

        return formattedDate;
    }

    /**
     * Determines the calendar ID for the event.
     *
     * @param {GoogleEvent} event - The event object.
     * @returns {string} - The calendar ID.
     */
    determineCalendarId(event) {
        return event?.parent?.id || this.defaultCalendar.id || "";
    }

    /**
     * Retrieves the parent calendar based on the calendar ID.
     *
     * @param {string} calendarId - The calendar ID.
     * @returns {Object} - The parent calendar object.
     */
    async getCalendarParent(calendarId) {
        const calendars = this.calendars;
        return calendars.find(calendar => calendar.id === calendarId);
    }

    /**
     * Handles errors that occur during the event update process.
     *
     * @param {Error} error - The error object.
     * @param {GoogleEvent} event - The event that was being updated.
     * @returns {null} - Indicates that the update process failed.
     */
    handleUpdateEventError(error, event) {
        switch (error.status) {
            case 401: // Handle specific error status as needed
                // ... 
                break;
            case 999:
                new Notice(`[TaskCard] ${error.message}`);
                break;
            default:
                // this.createNotice(`Google Event ${event.summary} could not be updated.`);
                new Notice(`Google Event ${event.summary} could not be updated.`);
                console.error('[GoogleCalendar]', error);
                break;
        }
        return null;
    }
    

    /**
     * Preprocesses the event, ensuring dates are in the correct format and time zones match the calendar's time zone.
     * @param event The event to preprocess.
     * @param calendar The calendar where the event will be added; used to set the event's time zone.
     * @returns The preprocessed event, ready to be sent to the Google Calendar API.
     */
    private preprocessEvent(event: Partial<GoogleEvent>, calendar: GoogleCalendar): Partial<GoogleEvent> {
        // Deep copy event to avoid mutating the original object
        const processedEvent = JSON.parse(JSON.stringify(event));

        // Ensure the event's time zone matches the calendar's time zone
        if (calendar.timeZone) {
            if (!processedEvent.start.timeZone) {
                processedEvent.start.timeZone = calendar.timeZone;
            }
            if (!processedEvent.end.timeZone) {
                processedEvent.end.timeZone = calendar.timeZone;
            }
        }

        return processedEvent;
    }

    private dateToGoogleDate(date: string): string {
        return moment(date).format("YYYY-MM-DD");
    }

    private dateTimeToGoogleDateTime(date: string): string {
        return moment(date).format();
    }

}



