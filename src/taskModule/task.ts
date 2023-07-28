import { Boolean, Number as NumberRunType, String, Array, Record, Static, Partial, Literal, Union } from 'runtypes';

export declare const DueDate: import("runtypes").Intersect<[Record<{
    isRecurring: Boolean;
    string: String;
    date: String;
}, false>, Partial<{
    datetime: Union<[String, Literal<null>]>;
    timezone: Union<[String, Literal<null>]>;
}, false>]>;

export type DueDate = Static<typeof DueDate>;

export type ProjectID = string;
export type SectionID = string;
export type Priority = number;

export interface TaskProperties {
    content: string;
    priority: Priority;
    description: string;
    order: number;
    projectID: ProjectID;
    sectionID: SectionID;
    labels: string[];
    completed: boolean;

    parent?: TaskProperties;
    children: TaskProperties[];

    due: DueDate;
    filePath: string;
}

export class ObsidianTask implements TaskProperties {
    public content: string;
    public priority: Priority;
    public description: string;
    public order: number;
    public projectID: ProjectID;
    public sectionID: SectionID;
    public labels: string[];
    public completed: boolean;

    public parent?: ObsidianTask;
    public children: ObsidianTask[];

    public due: DueDate;
    public filePath: string;



}

