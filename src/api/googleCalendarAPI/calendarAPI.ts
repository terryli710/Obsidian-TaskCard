

import { Notice } from "obsidian";
import { logger } from "../../utils/log";
import { GoogleCalendarAuthenticator } from "./authentication";
import { callRequest } from "./requestWrapper";
import { GoogleCalendar, GoogleCalendarList, GoogleEvent, GoogleEventList } from "./types";
import moment from "moment";
import { SettingStore } from "../../settings";
import { GoogleApiError } from "./googleAPIError";


export class GoogleCalendarAPI { 
    // TODO: to create new class instance somewhere in the plugin

    public authenticator: GoogleCalendarAuthenticator;
    public calendars: GoogleCalendar[];
    public defaultCalendar: GoogleCalendar;

    constructor() {
        this.authenticator = new GoogleCalendarAuthenticator();
        this.init();
        setTimeout(() => {
            this.test();
        }, 2000);
    }

    async init() {
        this.calendars = await this.listCalendars();
        SettingStore.subscribe((settings) => {
            const defaultCalendarId = settings.syncSettings.googleSyncSetting.defaultCalendarId;
            if (defaultCalendarId) {
                this.defaultCalendar = this.calendars.find(calendar => calendar.id === defaultCalendarId);
            }
        });

        // DEBUG
        this.defaultCalendar = this.calendars[1];
        logger.debug(`defaultCalendar: ${JSON.stringify(this.defaultCalendar)}`);
    }

    async test() {
        try {
            const startOfMonth = moment().startOf("month");
            const endOfMonth = moment().endOf("month");

            // Fetch events from the calendar within the specified date range
            const events: GoogleEvent[] = await this.getEventsInCalendar(this.calendars[0], startOfMonth, endOfMonth);

            console.log('Events in Calendar:', events);

            // Create a test event
            const testEvent: GoogleEvent = {
                summary: 'Test Event',
                description: 'This is a test event.',
                start: {
                    dateTime: moment().add(1, 'days').format(), // starts tomorrow
                    timeZone: 'America/Los_Angeles',
                },
                end: {
                    dateTime: moment().add(2, 'days').format(), // ends the day after tomorrow
                    timeZone: 'America/Los_Angeles',
                },
                // Add other event properties as needed
            };

            // Add the test event to the calendar
            const createdEvent = await this.createEvent(testEvent);

            console.log('Test Event Created:', createdEvent);

            // Check if there are any events, if so, use the first event's ID to test the getEvent method
            if (events.length > 0) {
                const firstEventId = events[0].id; // Extracting ID of the first event
                const calendarId = this.calendars[0].id; // Assuming you want to use the first calendar

                // Fetch the specific event by id from the calendar
                const event = await this.getEvent(firstEventId, calendarId);

                console.log('Single Event:', event);
            } else {
                console.log('No events found in the specified date range.');
            }
        } catch (error) {
            console.error('An error occurred:', error);
        }
    }

    async listCalendars(): Promise<GoogleCalendar[]> {
        if (!this.authenticator.isLogin) {
            new Notice(`[TaskCard] Not logged in to Google Calendar`);
            return [];
        }

        const calendarList = await callRequest(
            `https://www.googleapis.com/calendar/v3/users/me/calendarList`, 
            "GET", null)

        // logger.debug(`calendarList: ${JSON.stringify(calendarList.items)}`);

        return calendarList.items;
    }

    async getEventsInCalendar(
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
        const processedEvent = this.preprocessEvent(event, targetCalendar);


        try {
            // Assuming callRequest is accessible here, either as a global function or a method on this class.
            const createdEvent = await callRequest(
                `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendar.id)}/events?conferenceDataVersion=1`, 
                'POST', processedEvent);
            
            logger.info(`Google Event ${event.summary} created.`);
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
     * Preprocesses the event, ensuring dates are in the correct format and time zones match the calendar's time zone.
     * @param event The event to preprocess.
     * @param calendar The calendar where the event will be added; used to set the event's time zone.
     * @returns The preprocessed event, ready to be sent to the Google Calendar API.
     */
    private preprocessEvent(event: Partial<GoogleEvent>, calendar: GoogleCalendar): Partial<GoogleEvent> {
        // Deep copy event to avoid mutating the original object
        const processedEvent = JSON.parse(JSON.stringify(event));

        // Convert dates to Google's format
        if (processedEvent.start.date) {
            processedEvent.start.date = this.dateToGoogleDate(processedEvent.start.date); 
            processedEvent.end.date = this.dateToGoogleDate(processedEvent.end.date);
        } else if (processedEvent.start.dateTime) {
            processedEvent.start.dateTime = this.dateTimeToGoogleDateTime(processedEvent.start.dateTime); 
            processedEvent.end.dateTime = this.dateTimeToGoogleDateTime(processedEvent.end.dateTime);
        }

        // Ensure the event's time zone matches the calendar's time zone
        if (calendar.timeZone) {
            if (!processedEvent.start.timeZone) {
                processedEvent.start.timeZone = calendar.timeZone;
            }
            if (!processedEvent.end.timeZone) {
                processedEvent.end.timeZone = calendar.timeZone;
            }
        }

        // Perform any other necessary preprocessing here...

        return processedEvent;
    }

    private dateToGoogleDate(date: string): string {
        return moment(date).format("YYYY-MM-DD");
    }

    private dateTimeToGoogleDateTime(date: string): string {
        return moment(date).format();
    }





}



