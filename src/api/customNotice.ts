// Create custom notice for each API

import { Notice } from "obsidian";
import { logger } from "../utils/log";


class CustomAPINotice {
    pluginName: string;
    defaultAPIName: string;
    defaultIntervalMinutes: number;
    noticeMap: Map<string, moment.Moment>;

    constructor(pluginName = "TaskCard", defaultAPIName = "googleCalendarAPI", defaultIntervalMinutes = 1) {
        this.pluginName = pluginName;
        this.defaultAPIName = defaultAPIName;
        this.defaultIntervalMinutes = defaultIntervalMinutes;
        this.noticeMap = new Map();
    }

    createNotice(text, apiName: string, customIntervalMinutes = null, ignoreTimeout = false) {
        const now = window.moment();
        const noticeAPIName = apiName || this.defaultAPIName;
        const key = `${this.pluginName}-${noticeAPIName}-${text}`; // Unique key for each notice

        if (this.noticeMap.has(key)) {
            const lastDisplay = this.noticeMap.get(key);
            // Check if we're still within the cooldown period and if we're not ignoring the timeout
            if (!lastDisplay.isBefore(now) && !ignoreTimeout) {
                return; // within cooldown period, don't show notice
            }
        }

        // Show the notice with the customized prefix
        new Notice(`[${this.pluginName}: ${noticeAPIName}] ${text}`);
        logger.info(`[${this.pluginName}: ${noticeAPIName}] ${text}`); // Also log the notice

        // Update the last display time. Use the custom interval if provided, else use the default
        this.noticeMap.set(key, now.add(customIntervalMinutes || this.defaultIntervalMinutes, "minute"));
    }
}