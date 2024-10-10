import { TaskDisplayMode } from './renderer/postProcessor';

export enum DisplayMode {
    List = 'list',
    Matrix = 'matrix'
}

export interface TaskQuery {
    priorityQuery?: number[];
    projectQuery?: string[];
    labelQuery?: string[];
    completedQuery?: boolean[];
    scheduleDateTimeQuery?: [string, string];
    filePathQuery?: string;
    displayMode?: DisplayMode;
}

// Re-export TaskDisplayMode for consistency
export { TaskDisplayMode };