import { PositionedTaskProperties, DocPosition, Priority, DueDate, ObsidianTask, TextPosition, PositionedObsidianTask } from '../taskModule/task';
import TaskCardPlugin from '..';
import { getAPI } from 'obsidian-dataview';
import { QueryResult } from 'obsidian-dataview/lib/api/plugin-api';
import { logger } from '../utils/log';
import { SettingStore } from '../settings';
import Sugar from 'sugar';


import { IndexedMapDatabase, LogicalOperator } from './indexMapDatabase';

export interface MultipleAttributeTaskQuery {
    priorityQuery?: number[];
    projectQuery?: string[];
    labelQuery?: string[];
    completedQuery?: boolean[];
    dueDateTimeQuery?: [string, string];
    filePathQuery?: string;
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
    indicatorTag: string;
    status: {
      initialized: boolean
      refreshTimeStamp: number
    }

    constructor(plugin: TaskCardPlugin) {
        this.plugin = plugin;
        this.database = new TaskDatabase();
        SettingStore.subscribe((settings) => {
          this.indicatorTag = settings.parsingSettings.indicatorTag;
        });
        this.initializeAndRefreshAllTasks();
    }

    async initializeAndRefreshAllTasks() {
      const taskList = await this.fetchTasksFromAPI();
      this.database.updateDatabase(taskList.map(task => ({ id: task.id, item: task })));
      this.updateStatus(taskList.length, true);
    }
    
    // async refreshTasksByAttribute(attribute: string, value: any) {
    //   const taskList = await this.fetchTasksFromAPI(attribute, value);
    //   this.database.refreshTasksByAttribute(attribute, value, taskList.map(task => ({ id: task.id, item: task })));
    //   logger.info(`refreshTasksByAttribute ${attribute} ${value}, ${taskList.length} tasks refreshed`);
    //   this.updateStatus(taskList.length);
    // }
    
    private async fetchTasksFromAPI(attribute?: string, value?: any): Promise<PositionedTaskProperties[]> {
      const dataviewAPI = await getAPI();
      let query = `TASK FROM #${this.indicatorTag} WHERE contains(text, "#${this.indicatorTag}")`;
      // if (attribute && value) {
      //   query += ` AND ${attribute} = "${value}"`;
      // } // TODO: disabled for now
      // logger.debug(`fetchTasksFromAPI: ${query}`);
      const queryResult: QueryResult = await dataviewAPI.tryQuery(query);
      return this.parseQueryResult(queryResult);
    }

    async refreshTasksByFileList(fileList: string[]) {
      const taskList = await this.fetchTasksFromFileList(fileList);
      this.database.refreshTasksByFileList(fileList, taskList.map(task => ({ id: task.id, item: task })));
      this.updateStatus(taskList.length);
    }
    
    private async fetchTasksFromFileList(fileList?: string[]): Promise<PositionedTaskProperties[]> {
      const dataviewAPI = await getAPI();
      
      let fromClause = `#${this.indicatorTag}`;
      
      if (fileList && fileList.length > 0) {
        const filePathsQuery = fileList.map(f => `"${f.replace('.md', '')}"`).join(' OR ');
        fromClause += ` AND (${filePathsQuery})`;
      }
      
      const query = `TASK FROM ${fromClause} WHERE contains(text, "#${this.indicatorTag}")`;
      // logger.debug(`fetchTasksFromFileList: ${query}`);
      const queryResult: QueryResult = await dataviewAPI.tryQuery(query);
      
      return this.parseQueryResult(queryResult);
    }
    
    
    private updateStatus(taskCount: number, initialized: boolean = false) {
      logger.info(`TaskCache: ${initialized ? 'Found' : 'Refreshed'} ${taskCount} tasks`);
      this.status = {
        initialized: true,
        refreshTimeStamp: Date.now()
      };
    }

    parseQueryResult(queryResult: QueryResult): PositionedTaskProperties[] {
        const positionedTasks: PositionedTaskProperties[] = [];
        for (const task of queryResult.values) {
            const filePath = task.path;
            const startPosition: TextPosition = { line: task.position.start.line, col: task.position.start.col };
            const endPosition: TextPosition = { line: task.position.end.line, col: task.position.end.col };
            const originalText = `- [${task.status}] ` + task.text;
            const docPosition = { filePath: filePath, start: startPosition, end: endPosition }
            // if not valid formatted task, skip
            if (!this.plugin.taskValidator.isValidFormattedTaskMarkdown(originalText)) { continue; }
            const obsidianTask = this.plugin.taskParser.parseFormattedTaskMarkdown(originalText);
            // if content failed to parse, then this task is meaningless, we will skip it
            if (obsidianTask.content.length === 0) { continue; }
            positionedTasks.push(PositionedObsidianTask.fromObsidianTaskAndDocPosition(obsidianTask, docPosition));
        }
        return positionedTasks;
    }

    async queryTasks(query: MultipleAttributeTaskQuery): Promise<PositionedTaskProperties[]> {
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
    priorityQuery = [],
      projectQuery = [],
      labelQuery = [],
      completedQuery = [],
      dueDateTimeQuery = ['', ''],
      filePathQuery = '',
  }: MultipleAttributeTaskQuery): PositionedTaskProperties[] {
    const expression = {
      operator: 'AND' as LogicalOperator,
      operands: [
        task => priorityQuery && priorityQuery.length > 0 ? priorityQuery.includes(task.priority) : true,
        task => projectQuery && projectQuery.length > 0 ? projectQuery.includes(task.project.name) : true,
        task => labelQuery && labelQuery.length > 0 ? labelQuery.some(label => task.labels.includes(label)) : true,
        task => completedQuery && completedQuery.length > 0 ? completedQuery.includes(task.completed) : true,
        task => {
          // Case 3: If both start and end are empty strings, return true for all tasks
          if (!dueDateTimeQuery || (dueDateTimeQuery.length === 2 && dueDateTimeQuery[0] === '' && dueDateTimeQuery[1] === '')) {
            return true;
          }
          const [start, end] = dueDateTimeQuery;
        
          // If the task has a due date
          if (task.due) {
            const taskDateTime = Sugar.Date.create(task.due.string);
        
            // Case 1: If no start date is provided, filter tasks due before the end date
            if (start === '') {
              return Sugar.Date.isBefore(taskDateTime, end) || Sugar.Date.is(taskDateTime, end);
            }
        
            // Case 2: If no end date is provided, filter tasks due after the start date
            if (end === '') {
              return Sugar.Date.isAfter(taskDateTime, start) || Sugar.Date.is(taskDateTime, start);
            }
        
            // Default case: Filter tasks that are due between the start and end dates (inclusive)
            return Sugar.Date.isBetween(taskDateTime, start, end) || Sugar.Date.is(taskDateTime, start) || Sugar.Date.is(taskDateTime, end);
          }
        
          // If the task has no due date, it doesn't meet any of the filtering conditions
          return false;
        },
        task => filePathQuery && filePathQuery !== '' ? task.docPosition.filePath.startsWith(filePathQuery) : true
      ]
    };
    const filteredTasks = this.queryByComplexLogic(expression);
    return filteredTasks;
  }

  refreshTasksByFileList(fileList: string[], newTasks: Array<{ id: string, item: PositionedTaskProperties }>): void {
    const index = this.indices['filePath']; // Now accessible because it's protected in the parent class
    const idsToDelete = new Set<string>();

    // Collect all task IDs that belong to any of the files in the list
    fileList.forEach(filePath => {
      const ids = index.get(filePath) || new Set();
      ids.forEach(id => idsToDelete.add(id));
    });

    // Delete old tasks
    idsToDelete.forEach(id => {
      this.data.delete(id);
    });

    // Clear the index entries for these file paths
    fileList.forEach(filePath => {
      index.delete(filePath);
    });

    // Add new tasks
    this.bulkStore(newTasks);
  }
}