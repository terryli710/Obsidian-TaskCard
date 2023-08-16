import type { Static } from 'runtypes';
import { String } from 'runtypes';
import { v4 as uuidv4 } from 'uuid';
import { Project } from './project';

export const DateOnly = String.withConstraint(s => /^\d{4}-\d{2}-\d{2}$/.test(s));
export const TimeOnly = String.withConstraint(s => /^\d{2}:\d{2}$/.test(s));


export type DueDate = {
  isRecurring: boolean;
  date: Static<typeof DateOnly>;
  time?: Static<typeof TimeOnly> | null;
  string?: string;
  timezone?: string | null;
};

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

  constructor(props?: Partial<ObsidianTask>) {
    this.id = props?.id || uuidv4();
    this.content = props?.content || '';
    this.priority = props?.priority || 1;
    this.description = props?.description || '';
    this.order = props?.order || 0;
    this.project = props?.project || { id: '', name: '' };
    this.sectionID = props?.sectionID || '';
    this.labels = props?.labels || [];
    this.completed = props?.completed || false;
    this.parent = props?.parent || null;
    this.children = props?.children || [];
    this.due = props?.due || null;
    this.metadata = props?.metadata || {};
  }
}