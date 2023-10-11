// Manages all external APIs for the plugin

import { SettingStore, TaskCardSettings } from "../settings";
import { logger } from "../utils/log";
import { GoogleCalendarAPI } from "./googleCalendarAPI/calendarAPI";


export class ExternalAPIManager {
    private settings: TaskCardSettings;
    public googleCalendarAPI: GoogleCalendarAPI = undefined;

    constructor(settingStore: typeof SettingStore) {
        settingStore.subscribe((settings) => {
            this.settings = settings;
        });
    }

    initAPIs() {
        if (this.settings.syncSettings.googleSyncSetting.isLogin) {
            this.googleCalendarAPI = new GoogleCalendarAPI();
        }
    }






}