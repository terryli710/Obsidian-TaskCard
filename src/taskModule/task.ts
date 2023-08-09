import type { Static } from 'runtypes';
import { String } from 'runtypes';
import { v4 as uuidv4 } from 'uuid';


export const DateOnly = String.withConstraint(s => /^\d{4}-\d{2}-\d{2}$/.test(s));
export const TimeOnly = String.withConstraint(s => /^\d{2}:\d{2}$/.test(s));


export type DueDate = {
  isRecurring: boolean;
  date: Static<typeof DateOnly>;
  time?: Static<typeof TimeOnly> | null;
  string?: string;
  timezone?: string | null;
};

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
  order: Order | null;
  project: Project | null;
  sectionID: SectionID | null;
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
  public priority: Priority | null;
  public description: string;
  public order: Order | null;
  public project: Project | null;
  public sectionID: SectionID | null;
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
}
