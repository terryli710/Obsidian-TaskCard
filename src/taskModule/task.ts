import type { Static } from 'runtypes';
import { Record, Union, String, Literal, Boolean } from 'runtypes';
import { Partial as rtPartial } from 'runtypes';
import { camelToKebab, kebabToCamel } from '../utils/stringCaseConverter';
import { toArray, toBoolean } from '../utils/typeConversion';
import { v4 as uuidv4 } from 'uuid';


export const DateOnly = String.withConstraint(s => /^\d{4}-\d{2}-\d{2}$/.test(s));
export const TimeOnly = String.withConstraint(s => /^\d{2}:\d{2}$/.test(s));

export const DueDate = Record({
  isRecurring: Boolean,
  date: DateOnly,
  time: Union(TimeOnly, Literal(null)),
}).And(
  rtPartial({
    string: String,
    timezone: Union(String, Literal(null))
  })
);

export type DueDate = Static<typeof DueDate>;

export type Project = {
  id: string;
  name: string;
}
export type SectionID = string;
export type Priority = 1 | 2 | 3 | 4;
export type Order = number;

export interface TaskProperties {
  id: string;
  content: string;
  priority: Priority;
  description: string;
  order: Order;
  project: Project;
  sectionID: SectionID;
  labels: string[];
  completed: boolean;

  parent?: TaskProperties | null;
  children: TaskProperties[];

  due?: DueDate | null;
  metadata?: { [key: string]: string | number };

}

export class ObsidianTask implements TaskProperties {
  public id: string;
  public content: string;
  public priority: Priority;
  public description: string;
  public order: Order;
  public project: Project;
  public sectionID: SectionID;
  public labels: string[];
  public completed: boolean;

  public parent?: ObsidianTask | null;
  public children: ObsidianTask[];

  public due?: DueDate | null;
  public metadata?: { [key: string]: string | number };

  constructor() {
    this.id = uuidv4();
    this.content = '';
    this.priority = 1;
    this.description = '';
    this.order = 0;
    this.project = { id: '', name: '' };
    this.sectionID = '';
    this.labels = [];
    this.completed = false;
    this.parent = null;
    this.children = [];
    this.due = null;
    this.metadata = {};
  }

  toMarkdownLine(): string {
    let markdownLine = `- [${this.completed ? 'x' : ' '}] ${this.content}`;
    // completed and content have been converted to markdown, so exclude them
    for (let key in this) {
      if (key === 'completed' || key === 'content') continue;

      if (this[key] !== null && this[key] !== undefined) {
        let kebabCaseKey = camelToKebab(key);
        if(typeof this[key] === 'object') {
          markdownLine += `<span class="${kebabCaseKey}" style="display:none;">${JSON.stringify(this[key])}</span>`;
        } else {
          markdownLine += `<span class="${kebabCaseKey}" style="display:none;">${this[key]}</span>`;
        }
      }
    }

    return markdownLine;
  }

  static fromMarkdownLine(markdownLine: string) {
    let task: ObsidianTask = new ObsidianTask();
    let regex = /<span class="([^"]*)" style="display:none;">([^<]*)<\/span>/g;
    let match;

    let parsedValues: any = {};

    if (markdownLine.startsWith('- [')) { // TODO: consider indentation 
      parsedValues.completed = markdownLine[3] === 'x';
      parsedValues.content = markdownLine.slice(markdownLine.indexOf(']') + 2, markdownLine.indexOf('<'));
    }

    while ((match = regex.exec(markdownLine))) {
      let key = kebabToCamel(match[1]);
      let value = match[2];
  
      // Explicitly assert the type of the key
      const taskKey = key as keyof ObsidianTask;
  
      // Only assign the value if the key exists on ObsidianTask and parse it with correct type
      if (taskKey in task) {
        try {
          // Assuming that the arrays are in JSON format
          if (Array.isArray(task[taskKey])) {
            parsedValues[taskKey] = toArray(value);
          } else if (typeof task[taskKey] === 'boolean') {
            parsedValues[taskKey] = toBoolean(value);
          } else if (typeof task[taskKey] === 'string') {
            parsedValues[taskKey] = value;
          } else {
            parsedValues[taskKey] = JSON.parse(value);
          }
        } catch (e) {
          console.error(`Failed to convert value for key ${taskKey}: ${e.message}`);
        }
      }
    }

    // Now assign the parsedValues object to the task
    Object.assign(task, parsedValues);

    return task;
  }
}
