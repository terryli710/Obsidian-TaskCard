import { PositionedTaskProperties, TextPosition, PositionedObsidianTask } from '../taskModule/task';
import TaskCardPlugin from '..';
import { getAPI } from 'obsidian-dataview';
import { QueryResult } from 'obsidian-dataview/lib/api/plugin-api';
import { normalizePath } from 'obsidian';
import { logger } from '../utils/log';
import { SettingStore } from '../settings';
import Sugar from 'sugar';


import { IndexedMapDatabase, LogicalOperator } from './indexMapDatabase';

export interface MultipleAttributeTaskQuery {
    priorityQuery?: number[];
    projectQuery?: string[];
    labelQuery?: string[];
    completedQuery?: boolean[];
    scheduleDateTimeQuery?: [string, string];
    filePathQuery?: string;
    displayModeQuery?: string;
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
    schedule: string;
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
        this.status = {
          initialized: false,
          refreshTimeStamp: 0
        }
    }

    async initializeAndRefreshAllTasks() {
      const taskList = await this.fetchTasksFromAPI();
      this.database.updateDatabase(taskList.map(task => ({ id: task.id, item: task })));
      this.updateStatus(taskList.length, true);
    }

    // Polls for the Dataview API until it appears or `totalTime` elapses.
    // The executor is deliberately NOT async: an async executor swallows any
    // throw from getAPI() into a rejected promise nobody holds, leaving this
    // one pending forever. Routing every failure through reject() means a
    // broken Dataview surfaces as a timeout/error instead of a silent hang.
    async getDataviewAPI(totalTime = 1000, interval = 100) {
      let elapsed = 0;

      return new Promise((resolve, reject) => {
        const tryFetching = async () => {
          const dataviewAPI = await getAPI();

          if (dataviewAPI) {
            resolve(dataviewAPI);
            return;
          }

          elapsed += interval;

          if (elapsed >= totalTime) {
            reject(new Error("Timed out while fetching dataviewAPI"));
            return;
          }

          window.setTimeout(() => {
            tryFetching().catch(reject);
          }, interval);
        };

        tryFetching().catch(reject);
      });
    }
    
    
    private async fetchTasksFromAPI(attribute?: string, value?: any): Promise<PositionedTaskProperties[]> {
      let dataviewAPI;
      try {
        dataviewAPI = await this.getDataviewAPI();
      } catch (err) {
        logger.error("Error fetching dataview API:", err);
        return [];
      }
      let query = `TASK FROM #${this.indicatorTag} WHERE contains(text, "#${this.indicatorTag}")`;
      const queryResult: QueryResult = await dataviewAPI.tryQuery(query);
      return this.parseQueryResult(queryResult);
    }

    async refreshTasksByFileList(fileList: string[]) {
      const taskList = await this.fetchTasksFromFileList(fileList);
      this.database.refreshTasksByFileList(fileList, taskList.map(task => ({ id: task.id, item: task })));
      this.updateStatus(taskList.length);
    }
    
    private async fetchTasksFromFileList(fileList?: string[]): Promise<PositionedTaskProperties[]> {
      let dataviewAPI;
      try {
        dataviewAPI = await this.getDataviewAPI();
      } catch (err) {
        console.error("Error fetching dataview API:", err);
        return [];
      }
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
      // logger.info(`TaskCache: ${initialized ? 'Found' : 'Refreshed'} ${taskCount} tasks`);
      this.status = {
        initialized: true,
        refreshTimeStamp: Date.now()
      };
    }

    async parseQueryResult(queryResult: QueryResult): Promise<PositionedTaskProperties[]> {
        const positionedTasks: PositionedTaskProperties[] = [];
        for (const task of queryResult.values) {
            const filePath = task.path;
            const startPosition: TextPosition = { line: task.position.start.line, col: task.position.start.col };
            const endPosition: TextPosition = { line: task.position.end.line, col: task.position.end.col };
            const originalText = `- [${task.status}] ` + task.text;
            const docPosition = { filePath: filePath, start: startPosition, end: endPosition }
            // v2: any tagged task counts, whatever dialect it is written in
            if (!this.plugin.taskValidator.isTaskCardTaskMarkdown(originalText)) { continue; }
            const lines = (await this.plugin.fileOperator.getFileLines(filePath)).slice(task.position.start.line);
            const obsidianTask = this.plugin.taskParser.parseAnyTaskFromFileLines(lines);
            // if content failed to parse, then this task is meaningless, we will skip it
            if (obsidianTask.content.length === 0) { continue; }
            this.plugin.hydrateSyncMappings(obsidianTask);
            positionedTasks.push(PositionedObsidianTask.fromObsidianTaskAndDocPosition(obsidianTask, docPosition));
        }
        return positionedTasks;
    }

    async queryTasks(query: MultipleAttributeTaskQuery): Promise<PositionedTaskProperties[]> {
        // Perform the query
        return this.database.queryTasksByMultipleAttributes(query);
    }

    getLength() {
        return this.database.getLength();
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
    this.createIndex('schedule.date', item => item.schedule ? item.schedule.date : null);
    this.createIndex('schedule.time', item => item.schedule ? item.schedule.time : null);
    this.createIndex('schedule.string', item => item.schedule ? item.schedule.string : null);
    this.createIndex('filePath', item => item.docPosition.filePath);
  }

  queryTasksByMultipleAttributes({
    priorityQuery = [],
      projectQuery = [],
      labelQuery = [],
      completedQuery = [],
      scheduleDateTimeQuery = ['', ''],
      filePathQuery = '',
  }: MultipleAttributeTaskQuery): PositionedTaskProperties[] {
    // filePathQuery is typed by the user (query editor, or a hand-written
    // taskcard block), so it can carry a leading slash, backslash separators,
    // doubled slashes, or decomposed Unicode. Vault paths never do, and the
    // filter below is a prefix match, so normalize before comparing.
    const filePathPrefix = filePathQuery ? normalizePath(filePathQuery) : '';
    const expression = {
      operator: 'AND' as LogicalOperator,
      operands: [
        task => priorityQuery && priorityQuery.length > 0 ? priorityQuery.includes(task.priority) : true,
        task => projectQuery && projectQuery.length > 0 ? projectQuery.includes(task.project.name) : true,
        task => labelQuery && labelQuery.length > 0 ? labelQuery.some(label => task.labels.includes(label)) : true,
        task => completedQuery && completedQuery.length > 0 ? completedQuery.includes(task.completed) : true,
        task => {
          // Case 3: If both start and end are empty strings, return true for all tasks
          if (!scheduleDateTimeQuery || (scheduleDateTimeQuery.length === 2 && scheduleDateTimeQuery[0] === '' && scheduleDateTimeQuery[1] === '')) {
            return true;
          }
          const [start, end] = scheduleDateTimeQuery;
        
          // If the task has a schedule date
          if (task.schedule) {
            // Compare on the resolved date/time, never `string`: a raw
            // natural-language string ("tomorrow") would re-resolve against
            // "now" on every query and drift.
            const taskDateTime = Sugar.Date.create(
              task.schedule.time
                ? `${task.schedule.date} ${task.schedule.time}`
                : task.schedule.date
            );
        
            // Case 1: If no start date is provided, filter tasks schedule before the end date
            if (start === '') {
              return Sugar.Date.isBefore(taskDateTime, end) || Sugar.Date.is(taskDateTime, end);
            }
        
            // Case 2: If no end date is provided, filter tasks schedule after the start date
            if (end === '') {
              return Sugar.Date.isAfter(taskDateTime, start) || Sugar.Date.is(taskDateTime, start);
            }
        
            // Default case: Filter tasks that are schedule between the start and end dates (inclusive)
            return Sugar.Date.isBetween(taskDateTime, start, end) || Sugar.Date.is(taskDateTime, start) || Sugar.Date.is(taskDateTime, end);
          }
        
          // If the task has no schedule date, it doesn't meet any of the filtering conditions
          return false;
        },
        task => filePathPrefix !== '' ? normalizePath(task.docPosition.filePath).startsWith(filePathPrefix) : true

      ]
    };
    const filteredTasks = this.queryByComplexLogic(expression);
    return filteredTasks;
  }

  refreshTasksByFileList(fileList: string[], newTasks: Array<{ id: string, item: PositionedTaskProperties }>): void {
    // refreshTasksByAttribute removes the deleted ids from every index,
    // not just the filePath one, so no stale ids linger
    fileList.forEach(filePath => {
      this.refreshTasksByAttribute('filePath', filePath, []);
    });

    // Add new tasks
    this.bulkStore(newTasks);
  }
}