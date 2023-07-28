

export declare const DueDate: import("runtypes").Intersect<[Record<{
    isRecurring: Boolean;
    string: String;
    date: String;
}, false>, Partial<{
    datetime: Union<[String, Literal<null>]>;
    timezone: Union<[String, Literal<null>]>;
}, false>]>;

export interface TaskProperties {
    id: number;
    title: string;
    description: string;
    due: DueDate;
    priority: number;
    completed: boolean;
    tags: string[];
    parentId: number;
    sectionId: number;
    filePath: string;
}