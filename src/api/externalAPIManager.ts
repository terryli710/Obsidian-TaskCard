// Manages all external APIs for the plugin

import { SettingStore, TaskCardSettings } from "../settings";
import { ObsidianTask } from "../taskModule/task";
import { TaskChangeEvent, TaskChangeType } from "../taskModule/taskAPI";
import { GoogleCalendarAPI } from "./googleCalendarAPI/calendarAPI";


export interface SyncMappings {
    googleSyncSetting?: {
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
        const syncMappings = this.notifyTaskUpdates(event);
        return syncMappings;
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
        const oldSyncMappings = event.currentState.metadata.syncMappings || {};
        let syncMappings = oldSyncMappings;
        if (this.googleCalendarAPI) {
            const id = await this.googleCalendarAPI.handleLocalTaskCreation(event);
            syncMappings = { ...syncMappings, googleSyncSetting: { id: id } };
        }
        return syncMappings;
    }

    async notifyTaskUpdates(event: TaskChangeEvent): Promise<SyncMappings> {
        if (event.type !== TaskChangeType.UPDATE) return;
        const oldSyncMappings = event.currentState.metadata.syncMappings || {};
        let syncMappings = oldSyncMappings;
        if (this.googleCalendarAPI) {
            const id = await this.googleCalendarAPI.handleLocalTaskUpdate(event);
            syncMappings = { ...syncMappings, googleSyncSetting: { id: id } };
        }
        return syncMappings;
    }

    notifyTaskDeletions(event: TaskChangeEvent) {
        if (event.type !== TaskChangeType.REMOVE) return;
        if (this.googleCalendarAPI) this.googleCalendarAPI.handleLocalTaskDeletion(event);
    }


}