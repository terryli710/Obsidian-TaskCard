import type { Static } from 'runtypes';
import { String } from 'runtypes';
import { v4 as uuidv4 } from 'uuid';
import { Project } from './project';
import { TaskDisplayParams } from '../renderer/postProcessor';
import { logger } from '../utils/log';
import { isToday } from '../utils/dateTimeFormatter';

export const DateOnly = String.withConstraint((s) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s)
);
export const TimeOnly = String.withConstraint((s) => /^\d{2}:\d{2}$/.test(s));

export type DueDate = {
  isRecurring: boolean;
  date: Static<typeof DateOnly>;
  time?: Static<typeof TimeOnly> | null;
  string?: string;
  timezone?: string | null;
};


// Function to convert DueDate to dateTime string
export function convertToDateTime(dueDate: DueDate): string | null {
  if (dueDate.date) {
    let dateTime = dueDate.date;

    if (dueDate.time) {
      dateTime += `T${dueDate.time}`;
    } else {
      dateTime += 'T00:00'; // Default to midnight if no time is provided
    }

    if (dueDate.timezone) {
      // If a timezone is provided, we assume it's something like '-07:00' or '+05:30'
      dateTime += dueDate.timezone;
    } else {
      // If no timezone is provided, you might want to default to 'Z' (Zulu time/UTC)
      // or you could default to the local timezone offset. This example uses 'Z'.
      dateTime += 'Z';
    }

    return dateTime;
  }

  // If no valid date is available, return null or handle this case as per your application's needs
  return null;
}

// Function to calculate start and end dateTimes
export function calculateStartEndDateTime(dueDate: DueDate, duration: Duration): { start: string, end: string } | null {
  if (!dueDate.date) {
    return null; // or throw an error, depending on your error handling strategy
  }

  // Convert dueDate to a Date object
  const startDate = new Date(`${dueDate.date}T${dueDate.time || '00:00'}${dueDate.timezone || 'Z'}`);

  // Clone the startDate object to keep the original startDate unchanged
  const endDate = new Date(startDate);

  // Add the duration to the endDate
  endDate.setHours(endDate.getHours() + duration.hours);
  endDate.setMinutes(endDate.getMinutes() + duration.minutes);

  // Convert dates to ISO strings
  const startDateTime = startDate.toISOString();
  const endDateTime = endDate.toISOString();

  return { start: startDateTime, end: endDateTime };
}

export type Duration = {
  hours: number;
  minutes: number;
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

  parent?: TaskProperties | ObsidianTask | null;
  children: TaskProperties[] | ObsidianTask[];

  due?: DueDate | null;
  duration?: Duration | null;
  metadata?: {
    taskDisplayParams?: TaskDisplayParams | null;
    [key: string]: any; 
  };
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

  public parent?: TaskProperties | ObsidianTask | null;
  public children: TaskProperties[] | ObsidianTask[];

  public due?: DueDate | null;
  public duration?: Duration | null;
  
  public metadata?: {
    taskDisplayParams?: TaskDisplayParams | null;
    [key: string]: any; 
  };
  
  constructor(props?: Partial<ObsidianTask>) {
    this.id = props?.id || uuidv4();
    this.content = props?.content || '';
    this.priority = props?.priority || 4;
    this.description = props?.description || '';
    this.order = props?.order || 0;
    this.project = props?.project || { id: '', name: '' };
    this.sectionID = props?.sectionID || '';
    this.labels = props?.labels || [];
    this.completed = props?.completed || false;
    this.parent = props?.parent || null;
    this.children = props?.children || [];
    this.due = props?.due || null;
    this.duration = props?.duration || null;
    this.metadata = props?.metadata || {};
  }

  getCopy(): ObsidianTask {
    return new ObsidianTask({
      id: this.id,
      content: this.content,
      priority: this.priority,
      description: this.description,
      order: this.order,
      project: this.project,
      sectionID: this.sectionID,
      labels: this.labels,
      completed: this.completed,
      parent: this.parent,
      children: this.children,
      due: this.due,
      duration: this.duration,
      metadata: this.metadata,
    });
  }

  hasDescription() {
    return this.description.length > 0;
  }

  hasProject() {
    return this.project !== null && this.project.name.length > 0;
  }

  hasAnyLabels() {
    return this.labels.length > 0;
  }

  isCompleted() {
    return this.completed;
  }

  hasParent(): boolean {
    return this.parent !== null;
  }

  hasChildren(): boolean {
    return this.children.length > 0;
  }

  hasDue(): boolean {
    if (!this.due) return false;
    // return if the due string is not empty
    return !!this.due.string;
  }

  hasDuration(): boolean {
    if (!this.duration) return false;
    // return if the duration string is not empty = hours and minutes all zero
    return this.duration.hours > 0 || this.duration.minutes > 0;
  }

  setTaskDisplayParams(key: string, value: any): void {
    this.metadata.taskDisplayParams = {
      ...this.metadata.taskDisplayParams,
      [key]: value
    };
  }

  clearTaskDisplayParams(): void {
    this.metadata.taskDisplayParams = null;
  }

  toTaskProps(): TaskProperties {
    return this;
  }

}


export interface TextPosition {
  line: number;
  col: number;
}

export interface DocPosition {
  filePath: string,
  start: TextPosition,
  end: TextPosition,
}


export interface PositionedTaskProperties extends TaskProperties {
  docPosition: DocPosition;
}


export class PositionedObsidianTask extends ObsidianTask implements PositionedTaskProperties {
  public docPosition: DocPosition;

  constructor(props?: Partial<PositionedObsidianTask>) {
    super(props);
    this.docPosition = props?.docPosition || { filePath: '', start: { line: 0, col: 0 }, end: { line: 0, col: 0 } };
  }

  toPositionedTaskProps(): PositionedTaskProperties {
    return {
      ...this.toTaskProps(),
      docPosition: this.docPosition
    };
  }

  static fromObsidianTaskAndDocPosition(task: ObsidianTask, position: DocPosition): PositionedTaskProperties {
    return new PositionedObsidianTask({
      ...(task.toTaskProps() as Partial<PositionedObsidianTask>),
      docPosition: position
    });
  }

  toObsidianTask(): ObsidianTask {
    const { docPosition, ...taskProps } = this.toPositionedTaskProps();
    return new ObsidianTask(taskProps as Partial<ObsidianTask>);
  }

  toDocPosition(): DocPosition {
    return this.docPosition;
  }
}
