import { ObsidianTask } from "./task";


export enum TaskChangeType {
    ADD = 'add',
    UPDATE = 'update',
    REMOVE = 'remove',
}


export interface TaskChangeEvent {
    taskId: string;
    type: TaskChangeType;
    previousState?: ObsidianTask;
    currentState?: ObsidianTask;
    timestamp: Date;
}


export class TaskChangeAPI {
    private listeners: Array<(event: TaskChangeEvent) => void> = [];

    registerListener(listener: (event: TaskChangeEvent) => void): void {
        this.listeners.push(listener);
    }

    private notifyListeners(event: TaskChangeEvent): void {
        this.listeners.forEach(listener => listener(event));
    }

    // Use this method to record and notify about changes
    recordChange(event: TaskChangeEvent): void {
        // Logic to push change to the listeners

        // Notify listeners
        this.notifyListeners(event);
    }
}


export function getUpdatedProperties<T>(oldObj: T, newObj: T): Partial<T> {
    const updatedProperties: Partial<T> = {};

    for (const key in oldObj) {
        if (oldObj[key] !== newObj[key]) {
            updatedProperties[key] = newObj[key];
        }
    }

    return updatedProperties;
}