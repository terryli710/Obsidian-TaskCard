import type {
  Boolean,
  Number as NumberRunType,
  String,
  Record,
  Static,
  Partial,
  Literal,
  Union
} from 'runtypes';
import { Array } from 'runtypes';
import { camelToKebab, kebabToCamel } from '../utils/stringCaseConverter';

export declare const DueDate: import('runtypes').Intersect<
  [
    Record<
      {
        isRecurring: Boolean;
        string: String;
        date: String;
      },
      false
    >,
    Partial<
      {
        datetime: Union<[String, Literal<null>]>;
        timezone: Union<[String, Literal<null>]>;
      },
      false
    >
  ]
>;

export type DueDate = Static<typeof DueDate>;

export type Project = {
  id: string;
  name: string;
}
export type SectionID = string;
export type Priority = 1 | 2 | 3 | 4;
export type Order = number;

export interface TaskProperties {
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
  filePath: string;
}

export class ObsidianTask implements TaskProperties {
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
  public filePath: string;

  constructor() {
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
    this.filePath = '';
  }
  toMarkdownLine(): string {
    let markdownLine = `- [${this.completed ? 'x' : ' '}] ${this.content}`;
    
    for (let key in this) {
      if (this[key] !== null && this[key] !== undefined) {
        let kebabCaseKey = camelToKebab(key);
        if(typeof this[key] === 'object' && !(this[key] instanceof Array)) {
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

    if (markdownLine.startsWith('- [')) {
      parsedValues.completed = markdownLine[3] === 'x';
      parsedValues.content = markdownLine.slice(markdownLine.indexOf(']') + 2);
    }

    while ((match = regex.exec(markdownLine))) {
      let key = kebabToCamel(match[1]);
      let value = match[2];

      // Explicitly assert the type of the key
      const taskKey = key as keyof ObsidianTask;

      // Only assign the value if the key exists on ObsidianTask and parse it with correct type
      if (taskKey in task) {
        try {
          parsedValues[taskKey] = JSON.parse(value);
        } catch (e) {
          parsedValues[taskKey] = value;
        }
      }
    }

    // Now assign the parsedValues object to the task
    Object.assign(task, parsedValues);

    return task;
  }
}
