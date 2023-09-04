import TaskCardPlugin from "..";
import { SettingStore } from "../settings";
import { Project } from "../taskModule/project";
import { logger } from "../utils/log";
import { MultipleAttributeTaskQuery } from "./cache";

export interface TaskQueryOptions {
    priorityOptions: number[];
    projectOptions: Project[];
    labelOptions: string[];
    completedOptions: string[];
}


export class QuerySyncManager {
    plugin: TaskCardPlugin;
    blockLanguage: string;
    source: string;
    taskQuery: MultipleAttributeTaskQuery;
    defaultQuery: MultipleAttributeTaskQuery;
    options: TaskQueryOptions;
    codeBlockMetadata: {
        sourcePath: string;
        lineStart: number;
        lineEnd: number;
    }

    constructor(plugin: TaskCardPlugin, blockLanguage: string, source: string, codeBlockMetadata: {
        sourcePath: string;
        lineStart: number;
        lineEnd: number;
    }) {
        this.plugin = plugin;
        this.blockLanguage = blockLanguage;
        this.source = source;
        this.codeBlockMetadata = codeBlockMetadata;
        this.taskQuery = this.queryParser(this.source);
        this.options = {
            priorityOptions: [],
            projectOptions: [],
            labelOptions: [],
            completedOptions: []
        }
        this.defaultQuery = {
            priorityQuery: [],
            projectQuery: [],
            labelQuery: [],
            completedQuery: [],
            dueDateTimeQuery: ['', ''],
            filePathQuery: '',
        };
        this.initOptions();
    }

    queryParser(source: string): MultipleAttributeTaskQuery {
        const lines = source.split('\n');
        const query: MultipleAttributeTaskQuery = {
            priorityQuery: [],
            projectQuery: [],
            labelQuery: [],
            completedQuery: [],
            dueDateTimeQuery: ['', ''],
            filePathQuery: '',
        };
    
        for (const line of lines) {
            const indexOfFirstColon = line.indexOf(':');

            const key = line.substring(0, indexOfFirstColon).trim();
            const value = line.substring(indexOfFirstColon + 1).trim();
        
            if (key === 'priority') {
                query.priorityQuery = JSON.parse(value);
            } else if (key === 'project') {
                query.projectQuery = JSON.parse(value);
            } else if (key === 'label') {
                query.labelQuery = JSON.parse(value);
            } else if (key === 'completed') {
                query.completedQuery = JSON.parse(value);
            } else if (key === 'due') {
                query.dueDateTimeQuery = JSON.parse(value);
            } else if (key === 'file') {
                query.filePathQuery = value.replace(/['"]+/g, '');
            }
        }
    
        return query;
    }

    private getLabelsFromDatabase(): string[] {
        const labels = this.plugin.cache.taskCache.database
            .getAllIndexValues('labels')
            .reduce((acc, val) => acc.concat(val), []);
        return Array.from(new Set(labels));
    }

    private initOptions() {
        this.options.completedOptions = ['true', 'false'];
        this.options.priorityOptions = [1, 2, 3, 4];
        SettingStore.subscribe((settings) => {
            this.options.projectOptions = settings.userMetadata.projects;
        })
        this.options.labelOptions = this.getLabelsFromDatabase();
    }

    refreshOptions() {
        this.options.labelOptions = this.getLabelsFromDatabase();
    }

    // Method to set default query values
    setDefaultQueryValues(query: MultipleAttributeTaskQuery) {
        for (const key in this.defaultQuery) {
            if (query[key] === undefined || query[key] === null) {
                query[key] = this.defaultQuery[key];
            }
        }
        return query;
    }

    queryFormatter(query: MultipleAttributeTaskQuery): string {
        let source = "";
        
        if (query.priorityQuery !== undefined && query.priorityQuery !== null) {
            source += `priority: ${JSON.stringify(query.priorityQuery)}\n`;
        }
        
        if (query.projectQuery !== undefined && query.projectQuery !== null) {
            source += `project: ${JSON.stringify(query.projectQuery)}\n`;
        }
        
        if (query.labelQuery !== undefined && query.labelQuery !== null) {
            source += `label: ${JSON.stringify(query.labelQuery)}\n`;
        }
        
        if (query.completedQuery !== undefined && query.completedQuery !== null) {
            source += `completed: ${JSON.stringify(query.completedQuery)}\n`;
        }
        
        if (query.dueDateTimeQuery !== undefined && query.dueDateTimeQuery !== null) {
            source += `due: ${JSON.stringify(query.dueDateTimeQuery)}\n`;
        }
        
        if (query.filePathQuery !== undefined && query.filePathQuery !== null) {
            source += `file: "${query.filePathQuery}"\n`;
        }
        
        return source.trim(); // Remove the trailing newline
        }
    
    formatCodeBlock(queryString: string) {
        return `\`\`\`${this.blockLanguage}\n${queryString}\n\`\`\``;
    }

    updateTaskQueryToFile(taskQuery: MultipleAttributeTaskQuery) {
        const filledQuery = this.setDefaultQueryValues(taskQuery);
        const newQuery = this.formatCodeBlock(this.queryFormatter(filledQuery));
        this.plugin.fileOperator.updateFile(
            this.codeBlockMetadata.sourcePath, 
            newQuery, 
            this.codeBlockMetadata.lineStart, 
            this.codeBlockMetadata.lineEnd + 1
        );
    }
}