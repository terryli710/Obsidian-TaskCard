

// TODO: syncs automatically

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
        this.calendars = await this.getCalendars();
    }

    async test() {
        const startOfMonth = moment().startOf("month");
        const endOfMonth = moment().endOf("month");
        this.getEventsInCalendar(this.calendars[0], startOfMonth, endOfMonth); 
    }

    async getCalendars(): Promise<GoogleCalendar[]> {
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

        // Prepare for the request
        let totalEventList: GoogleEvent[] = [];
        let nextPageToken: string | undefined;

        do {
            let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?`;
            url += `maxResults=${resultSize}`;
            url += `&singleEvents=true`;
            url += `&orderBy=startTime`; // Adjusted to the correct case as per Google Calendar API
            url += `&timeMin=${startString}`;
            url += `&timeMax=${endString}`;

            if (nextPageToken) {
                url += `&pageToken=${nextPageToken}`;
            }

            // Make the API request
            const tmpRequestResult: GoogleEventList = await callRequest(url, "GET", null); // Ensure callRequest is accessible here

            // Filter events and assign the calendar as the parent to each event
            const newList = tmpRequestResult.items.filter((event) => {
                event.parent = calendar;
                return event.status !== "cancelled";
            });

            totalEventList = [...totalEventList, ...newList];

            // Prepare for the next iteration if necessary
            nextPageToken = tmpRequestResult.nextPageToken;
        } while (nextPageToken && totalEventList.length < resultSize); // Adjusted condition for readability and correctness

        return totalEventList;
    }

    createEventInCalendar() {

    }




}



