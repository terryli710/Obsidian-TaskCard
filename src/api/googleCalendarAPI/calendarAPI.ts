

import { Notice } from "obsidian";
import { logger } from "../../utils/log";
import { GoogleCalendarAuthenticator } from "./authentication";
import { callRequest } from "./requestWrapper";
import { GoogleCalendar, GoogleCalendarList, GoogleEvent, GoogleEventList } from "./types";
import moment from "moment";


export class GoogleCalendarAPI { 
    // TODO: to create new class instance somewhere in the plugin

    authenticator: GoogleCalendarAuthenticator;
    public calendars: GoogleCalendar[];

    constructor() {
        this.authenticator = new GoogleCalendarAuthenticator();
        this.init();
        setTimeout(() => {
            this.test();
        }, 2000);
    }

    async init() {
        this.calendars = await this.listCalendars();
    }

    async test() {
        try {
            const startOfMonth = moment().startOf("month");
            const endOfMonth = moment().endOf("month");

            // Fetch events from the calendar within the specified date range
            const events: GoogleEvent[] = await this.getEventsInCalendar(this.calendars[0], startOfMonth, endOfMonth);

            console.log('Events in Calendar:', events);

            // Check if there are any events, if so, use the first event's ID to test the getEvent method
            if (events.length > 0) {
                const firstEventId = events[0].id; // Extracting ID of the first event
                const calendarId = this.calendars[0].id; 

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





}



