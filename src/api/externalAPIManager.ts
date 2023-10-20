// Manages all external APIs for the plugin

import { SettingStore, TaskCardSettings } from "../settings";
import { ObsidianTask } from "../taskModule/task";
import { TaskChangeEvent, TaskChangeType } from "../taskModule/taskAPI";
import { logger } from "../utils/log";
import { GoogleCalendarAPI } from "./googleCalendarAPI/calendarAPI";


export interface SyncMappings {
    googleSyncSetting: {
        id: string;
    }
}

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

    async createTask(task: ObsidianTask): Promise<SyncMappings> {
        // build task change event
        const event: TaskChangeEvent = {
            taskId: task.id,
            type: TaskChangeType.ADD,
            currentState: task,
            timestamp: new Date(),
        }
        const syncMappings = await this.notifyTaskCreations(event);
        // logger.debug(`syncMappings: ${JSON.stringify(syncMappings)}`);
        return syncMappings;
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
        this.notifyTaskUpdates(event);
    }

    deleteTask(task: ObsidianTask) {
        // build task change event
        const event: TaskChangeEvent = {
            taskId: task.id,
            type: TaskChangeType.REMOVE,
            previousState: task,
            timestamp: new Date(),
        }
        this.notifyTaskDeletions(event);
    }

    async notifyTaskCreations(event: TaskChangeEvent): Promise<SyncMappings> {
        if (event.type !== TaskChangeType.ADD) return;
        const id = await this.googleCalendarAPI.handleLocalTaskCreation(event);
        return { googleSyncSetting: { id: id } };
    }

    notifyTaskUpdates(event: TaskChangeEvent) {
        if (event.type !== TaskChangeType.UPDATE) return;
        if (event.currentState.metadata.syncMappings.googleSyncSetting.id) {
            this.googleCalendarAPI.handleLocalTaskUpdate(event);
        }
    }

    notifyTaskDeletions(event: TaskChangeEvent) {
        if (event.type !== TaskChangeType.REMOVE) return;
        if (event.previousState.metadata.syncMappings.googleSyncSetting.id) {
            logger.debug(`deleting task with id: ${event.previousState.metadata.syncMappings.googleSyncSetting.id}`);
            this.googleCalendarAPI.handleLocalTaskDeletion(event);
        }
    }


}