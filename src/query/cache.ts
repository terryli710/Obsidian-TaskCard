import { PositionedTaskProperties, DocPosition, Priority, DueDate, ObsidianTask, TextPosition, PositionedObsidianTask } from '../taskModule/task';
import { Project } from '../taskModule/project';
import TaskCardPlugin from '..';
import { getAPI } from 'obsidian-dataview';
import { QueryResult } from 'obsidian-dataview/lib/api/plugin-api';
import { logger } from '../utils/log';

import { IndexedMapDatabase, LogicalExpression } from './indexMapDatabase';

export interface MultipleAttributeTaskQuery {
    priorityQuery?: number[] | null;
    projectQuery?: string[] | null;
    labelQuery?: string[] | null;
    completedQuery?: boolean[] | null;
    dueDateTimeQuery?: [string, string] | null;
    filePathQuery?: string | null;
}

export interface TaskRow {
    id: string;
    content: string;
    priority: string;
    description: string;
    order: string;
    project: string;
    sectionID: string;
    labels: string;
    completed: boolean;
    parentID: string;
    due: string;
    metadata: string;
    filePath: string;
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
}

export class PositionedTaskCache {
    database: TaskDatabase;
    private plugin: TaskCardPlugin;
    initialized: boolean = false;

    constructor(plugin: TaskCardPlugin) {
        this.plugin = plugin;
        this.database = new TaskDatabase();
        this.initializeDatabase();
    }

    async initializeDatabase() {
        const queryResult: QueryResult = await getAPI().tryQuery('TASK FROM #TaskCard WHERE contains(text, "#TaskCard")')
        const taskList = this.parseQueryResult(queryResult);
        logger.info(`TaskCache: Found ${taskList.length} tasks`);
        this.database.bulkStore(taskList.map(task => ({ id: task.id, item: task })));
    }

    parseQueryResult(queryResult: QueryResult): PositionedTaskProperties[] {
        const positionedTasks: PositionedTaskProperties[] = [];
        for (const task of queryResult.values) {
            const filePath = task.path;
            // const lineNumber = task.line;
            const startPosition: TextPosition = { line: task.position.start.line, col: task.position.start.col };
            const endPosition: TextPosition = { line: task.position.end.line, col: task.position.end.col };
            const originalText = `- [${task.status}] ` + task.text;
            const docPosition = { filePath: filePath, start: startPosition, end: endPosition }
            const obsidianTask = this.plugin.taskParser.parseFormattedTaskMarkdown(originalText);
            positionedTasks.push(PositionedObsidianTask.fromObsidianTaskAndDocPosition(obsidianTask, docPosition));
        }
        return positionedTasks;
    }

    async queryTasks(query: MultipleAttributeTaskQuery): Promise<PositionedTaskProperties[]> {
        // Ensure the database is initialized
        if (!this.initialized) {
            await this.initializeDatabase();
        }

        // Perform the query
        return this.database.queryTasksByMultipleAttributes(query);
    }

    
}

export class TaskDatabase extends IndexedMapDatabase<PositionedTaskProperties> {
  constructor() {
    super();
    // Create indices for various fields
    this.createIndex('priority', item => item.priority);
    this.createIndex('project', item => item.project.name);
    this.createIndex('labels', item => item.labels.join(','));
    this.createIndex('completed', item => item.completed);
    this.createIndex('due.date', item => item.due ? item.due.date : null);
    this.createIndex('due.time', item => item.due ? item.due.time : null);
    this.createIndex('due.string', item => item.due ? item.due.string : null);
    this.createIndex('filePath', item => item.docPosition.filePath);
  }

  queryTasksByMultipleAttributes({
    priorityQuery = null,
    projectQuery = null,
    labelQuery = null,
    completedQuery = null,
    dueDateTimeQuery = null,
    filePathQuery = null
  }: MultipleAttributeTaskQuery): PositionedTaskProperties[] {
    const expression: LogicalExpression<PositionedTaskProperties> = {
      operator: 'AND',
      operands: [
        task => priorityQuery ? priorityQuery.includes(task.priority) : true,
        task => projectQuery ? projectQuery.includes(task.project.name) : true,
        task => labelQuery ? labelQuery.some(label => task.labels.includes(label)) : true,
        task => completedQuery ? completedQuery.includes(task.completed) : true,
        task => {
          if (!dueDateTimeQuery) return true;
          const [start, end] = dueDateTimeQuery;
          if (task.due) {
            const taskDateTime = Sugar.Date.create(task.due.string);
            return Sugar.Date.isBetween(taskDateTime, start, end) || Sugar.Date.is(taskDateTime, start);
          }
          return false;
        },
        task => filePathQuery ? task.docPosition.filePath.startsWith(filePathQuery) : true
      ]
    };

    return this.queryByComplexLogic(expression);
  }
}