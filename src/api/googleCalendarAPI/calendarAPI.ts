

// TODO: syncs automatically

import { logger } from "../../utils/log";
import { GoogleCalendarAuthenticator } from "./authentication";
import { callRequest } from "./requestWrapper";
import { GoogleCalendar, GoogleCalendarList, GoogleEvent } from "./types";


export class GoogleCalendarAPI { 
    // TODO: to create new class instance somewhere in the plugin

    authenticator: GoogleCalendarAuthenticator;
    public calendars: GoogleCalendar[];

    constructor() {
        this.authenticator = new GoogleCalendarAuthenticator();
        this.init();
        this.test();
    }

    async init() {
        this.calendars = await this.getCalendars();
    }

    async test() {
        this.getEventsInCalendar(this.calendars[0].id); 
    }

    async getCalendars(): Promise<GoogleCalendar[]> {
        
        const calendarList: GoogleCalendarList = await callRequest(
            `https://www.googleapis.com/calendar/v3/users/me/calendarList`, 
            "GET", null)

        logger.debug(JSON.stringify(calendarList));

        return calendarList.items;
    }

    async getEventsInCalendar(calendarId: string): Promise<GoogleEvent[]> {
        
        const eventList: GoogleEvent[] = await callRequest(
            `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, 
            "GET", null)
        
        logger.debug(JSON.stringify(eventList));

        return eventList;
    }

    createEventInCalendar() {

    }




}



