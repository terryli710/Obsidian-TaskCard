import TaskCardPlugin from "..";
import { SettingStore } from "../settings";
import { Project } from "../taskModule/project";
import { MultipleAttributeTaskQuery } from "./cache";

export interface TaskQueryOptions {
    priorityOptions: number[];
    projectOptions: string[];
    labelOptions: string[];
    completedOptions: string[];
}


export class QuerySyncManager {
    plugin: TaskCardPlugin;
    blockLanguage: string;
    source: string;
    taskQuery: MultipleAttributeTaskQuery;
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
        this.initOptions();
    }

    queryParser(source: string): MultipleAttributeTaskQuery {
        const lines = source.split('\n');
        const query: MultipleAttributeTaskQuery = {
            priorityQuery: null,
            projectQuery: null,
            labelQuery: null,
            completedQuery: null,
            dueDateTimeQuery: null,
            filePathQuery: null
        };
    
        for (const line of lines) {
            const [key, value] = line.split(':').map(str => str.trim());
        
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

    private initOptions() {
        this.options.completedOptions = ['true', 'false'];
        this.options.priorityOptions = [1, 2, 3, 4];
        SettingStore.subscribe((settings) => {
            this.options.projectOptions = settings.userMetadata.projects.map((project: Project) => {
                return project.name
            })
        })
        this.options.labelOptions = this.plugin.cache.taskCache.database.getAllIndexValues('label');
    }

    refreshOptions() {
        this.options.labelOptions = this.plugin.cache.taskCache.database.getAllIndexValues('label');
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
        const newQuery = this.formatCodeBlock(this.queryFormatter(taskQuery));
        this.plugin.fileOperator.updateFile(
            this.codeBlockMetadata.sourcePath, 
            newQuery, 
            this.codeBlockMetadata.lineStart, 
            this.codeBlockMetadata.lineEnd
        );
    }
}