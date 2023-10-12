// Manages all external APIs for the plugin

import { SettingStore, TaskCardSettings } from "../settings";
import { ObsidianTask } from "../taskModule/task";
import { TaskChangeEvent, TaskChangeType } from "../taskModule/taskAPI";
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

    createTask(task: ObsidianTask) {
        // build task change event
        const event: TaskChangeEvent = {
            taskId: task.id,
            type: TaskChangeType.ADD,
            currentState: task,
            timestamp: new Date(),
        }
        this.notifyChange(event);
    }

    updateTask(task: ObsidianTask, origTask?: ObsidianTask) {
        // build task change event
        const event: TaskChangeEvent = {
            taskId: task.id,
            type: TaskChangeType.UPDATE,
            currentState: task,
            previousState: origTask,
            timestamp: new Date(),
        }
        this.notifyChange(event);
    }

    deleteTask(task: ObsidianTask) {
        // build task change event
        const event: TaskChangeEvent = {
            taskId: task.id,
            type: TaskChangeType.REMOVE,
            previousState: task,
            timestamp: new Date(),
        }
        this.notifyChange(event);
    }

    notifyChange(event: TaskChangeEvent) {
        this.googleCalendarAPI.handleLocalTaskChanges(event);
    }


}