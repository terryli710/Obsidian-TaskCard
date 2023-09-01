import { Database } from 'sqlite3';
import { PositionedTaskProperties, DocPosition, Priority, DueDate, ObsidianTask, TextPosition, PositionedObsidianTask } from '../taskModule/task';
import { Project } from '../taskModule/project';
import TaskCardPlugin from '..';
import { getAPI } from 'obsidian-dataview';
import { QueryResult } from 'obsidian-dataview/lib/api/plugin-api';
import { logger } from '../utils/log';


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
    database: PositionedTaskDatabase;
    private plugin: TaskCardPlugin;
    initialized: boolean = false;

    constructor(plugin: TaskCardPlugin) {
        this.plugin = plugin;
        this.database = new PositionedTaskDatabase();
        this.initializeDatabase();
    }

    async initializeDatabase() {
        const queryResult: QueryResult = await getAPI().tryQuery('TASK FROM #TaskCard WHERE contains(text, "#TaskCard")')
        const taskList = this.parseQueryResult(queryResult);
        logger.info(`TaskCache: Found ${taskList.length} tasks`);
        this.database.storeMultiple(taskList);
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
}


export class PositionedTaskDatabase {
    private db: Database;

    constructor() {
        this.db = new Database('positionedTasks.db');
        this.initialize();
    }

    private initialize() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                content TEXT,
                priority TEXT,
                description TEXT,
                order TEXT,
                project TEXT,
                sectionID TEXT,
                labels TEXT,
                completed BOOLEAN,
                parentID TEXT,
                due TEXT,
                metadata TEXT,
                filePath TEXT,
                startLine INTEGER,
                startCol INTEGER,
                endLine INTEGER,
                endCol INTEGER
            )
        `);
    }

    store(task: PositionedTaskProperties) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO tasks 
            (id, content, priority, description, order, project, sectionID, labels, completed, parentID, due, metadata, filePath, startLine, startCol, endLine, endCol) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const { filePath, start, end } = task.docPosition;
        stmt.run(task.id, task.content, task.priority, task.description, task.order, task.project, task.sectionID, JSON.stringify(task.labels), task.completed, task.parent?.id, task.due, JSON.stringify(task.metadata), filePath, start.line, start.col, end.line, end.col);
        stmt.finalize();
    }

    // Method to store multiple tasks efficiently
    storeMultiple(tasks: PositionedTaskProperties[]) {
        // Start a transaction
        this.db.serialize(() => {
            this.db.run('BEGIN TRANSACTION');

            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO tasks 
                (id, content, priority, description, order, project, sectionID, labels, completed, parentID, due, metadata, filePath, startLine, startCol, endLine, endCol) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const task of tasks) {
                const { filePath, start, end } = task.docPosition;
                stmt.run(task.id, task.content, task.priority, task.description, task.order, task.project, task.sectionID, JSON.stringify(task.labels), task.completed, task.parent?.id, task.due, JSON.stringify(task.metadata), filePath, start.line, start.col, end.line, end.col);
            }

            stmt.finalize();

            // Commit the transaction
            this.db.run('COMMIT');
        });
    }

    update(task: PositionedTaskProperties) {
        const stmt = this.db.prepare(`
            UPDATE tasks SET 
            content = ?, priority = ?, description = ?, order = ?, project = ?, sectionID = ?, labels = ?, completed = ?, parentID = ?, due = ?, metadata = ?, filePath = ?, startLine = ?, startCol = ?, endLine = ?, endCol = ?
            WHERE id = ?
        `);
        const { filePath, start, end } = task.docPosition;
        stmt.run(task.content, task.priority, task.description, task.order, task.project, task.sectionID, JSON.stringify(task.labels), task.completed, task.parent?.id, task.due, JSON.stringify(task.metadata), filePath, start.line, start.col, end.line, end.col, task.id);
        stmt.finalize();
    }

    delete(taskId: string) {
        const stmt = this.db.prepare("DELETE FROM tasks WHERE id = ?");
        stmt.run(taskId);
        stmt.finalize();
    }

    add(task: PositionedTaskProperties) {
        this.store(task);
    }

    filter(query: string, callback: (err: Error, rows: PositionedTaskProperties[]) => void): void {
        this.db.all(query, (err, rows: TaskRow[]) => {
            if (err) {
                callback(err, []);
                return;
            }
            const positionedTasks: PositionedTaskProperties[] = rows.map(row => {
                const priority = Number(row.priority) as Priority; // Convert to Priority type
                const order = row.order ? Number(row.order) : null; // Convert to Order type or null
                const project = row.project ? JSON.parse(row.project) as Project : null; // Assuming project is stored as JSON string
                const sectionID = row.sectionID || null; // Use as-is or null
                const labels = row.labels ? JSON.parse(row.labels) as string[] : []; // Assuming labels are stored as JSON string array
                const completed = Boolean(row.completed); // Convert to boolean
                const parent = null;
                const children = [];
                const due = row.due ? JSON.parse(row.due) as DueDate : null; // Assuming due is stored as JSON string
                const metadata = row.metadata ? JSON.parse(row.metadata) : {}; // Assuming metadata is stored as JSON string
    
                return {
                    id: row.id,
                    content: row.content,
                    priority,
                    description: row.description,
                    order,
                    project,
                    sectionID,
                    labels,
                    completed,
                    parent,
                    children,
                    due,
                    metadata,
                    docPosition: {
                        filePath: row.filePath,
                        start: { line: row.startLine, col: row.startCol },
                        end: { line: row.endLine, col: row.endCol }
                    }
                };
            });
            callback(null, positionedTasks);
        });
    }
    
    filterWithFunction(query: string = '', filterFunc: (task: PositionedTaskProperties) => boolean, callback: (err: Error, rows: PositionedTaskProperties[]) => void) {
        this.db.all(query, (err, rows: TaskRow[]) => {
            if (err) {
                callback(err, []);
                return;
            }
            const positionedTasks: PositionedTaskProperties[] = rows.map(row => {
                const priority = Number(row.priority) as Priority; // Convert to Priority type
                const order = row.order ? Number(row.order) : null; // Convert to Order type or null
                const project = row.project ? JSON.parse(row.project) as Project : null; // Assuming project is stored as JSON string
                const sectionID = row.sectionID || null; // Use as-is or null
                const labels = row.labels ? JSON.parse(row.labels) as string[] : []; // Assuming labels are stored as JSON string array
                const completed = Boolean(row.completed); // Convert to boolean
                const parent = null;
                const children = [];
                const due = row.due ? JSON.parse(row.due) as DueDate : null; // Assuming due is stored as JSON string
                const metadata = row.metadata ? JSON.parse(row.metadata) : {}; // Assuming metadata is stored as JSON string


                return {
                    id: row.id,
                    content: row.content,
                    priority,
                    description: row.description,
                    order,
                    project,
                    sectionID,
                    labels,
                    completed,
                    parent,
                    children,
                    due,
                    metadata,
                    docPosition: {
                        filePath: row.filePath,
                        start: { line: row.startLine, col: row.startCol },
                        end: { line: row.endLine, col: row.endCol }
                    }
                };
            }).filter(filterFunc);
            callback(null, positionedTasks);
    });

    }
    

}
