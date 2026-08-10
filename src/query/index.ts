import TaskCardPlugin from '..';
import { PositionedTaskCache } from './cache';


export class TaskCardCache {
    taskCache: PositionedTaskCache;

    constructor(plugin: TaskCardPlugin) {
        this.taskCache = new PositionedTaskCache(plugin);
    }
}