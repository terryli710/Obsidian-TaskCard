import { moment } from './obsidianMoment';
import type { Moment } from './obsidianMoment';
import type { Duration, ScheduleDate } from '../taskModule/task';

export const RELATIVE_TIME_WINDOW_HOURS = 48;

export type TemporalKind = 'due' | 'scheduled';
export type TemporalStatus =
  | 'upcoming'
  | 'ongoing'
  | 'past-incomplete'
  | 'past-complete'
  | null;

export interface TemporalPresentation {
  text: string;
  tooltip: string;
}

function localMoment(value: ScheduleDate): Moment {
  return value.time
    ? moment(`${value.date}T${value.time}`, 'YYYY-MM-DDTHH:mm', true)
    : moment(value.date, 'YYYY-MM-DD', true);
}

function formatAbsolute(value: ScheduleDate, now: Moment): string {
  const date = localMoment(value);
  const dateFormat = date.year() === now.year() ? 'ddd, MMM D' : 'ddd, MMM D, YYYY';
  return value.time
    ? `${date.format(dateFormat)} · ${date.format('h:mm A')}`
    : date.format(dateFormat);
}

function formatDayResolution(value: ScheduleDate, now: Moment): string {
  const date = localMoment(value).startOf('day');
  const today = now.clone().startOf('day');
  const dayDifference = date.diff(today, 'days');
  if (dayDifference === -1) return 'Yesterday';
  if (dayDifference === 0) return 'Today';
  if (dayDifference === 1) return 'Tomorrow';
  if (date.isSame(today, 'week')) return date.format('ddd');
  return date.year() === today.year() ? date.format('MMM D') : date.format('MMM D, YYYY');
}

function relativeDistance(target: Moment, now: Moment): string {
  const minutes = Math.abs(target.diff(now, 'minutes', true));
  if (minutes < 1) return 'now';
  if (minutes < 60) {
    const count = Math.max(1, Math.floor(minutes));
    return `${count} minute${count === 1 ? '' : 's'}`;
  }
  const hours = minutes / 60;
  if (hours < 24) {
    const count = Math.floor(hours);
    return `${count} hour${count === 1 ? '' : 's'}`;
  }
  const count = Math.floor(hours / 24);
  return `${count} day${count === 1 ? '' : 's'}`;
}

/** The chosen hybrid strategy: day labels stay day-resolution, while exact
 * instants are relative within 48 hours and absolute farther away. */
export function getTemporalPresentation(
  value: ScheduleDate,
  kind: TemporalKind,
  now: Moment = moment()
): TemporalPresentation {
  if (!value.time) {
    return {
      text: formatDayResolution(value, now),
      tooltip: `Any time on ${formatAbsolute(value, now)}`
    };
  }

  const target = localMoment(value);
  const tooltip = formatAbsolute(value, now);
  const distanceHours = Math.abs(target.diff(now, 'hours', true));
  if (distanceHours > RELATIVE_TIME_WINDOW_HOURS) {
    return { text: tooltip, tooltip };
  }

  const distance = relativeDistance(target, now);
  if (distance === 'now') return { text: 'now', tooltip };
  if (target.isBefore(now)) {
    return {
      text: kind === 'due' ? `${distance} overdue` : `${distance} ago`,
      tooltip
    };
  }
  return { text: `in ${distance}`, tooltip };
}

/**
 * Status coloring shares the same resolution rule as the display. A day-only
 * value does not become past at local midnight; its boundary is end-of-day.
 */
export function getTemporalStatus(
  value: ScheduleDate | null | undefined,
  duration: Duration | null | undefined,
  completed: boolean,
  now: Moment = moment(),
  upcomingMinutes = 15
): TemporalStatus {
  if (!value?.date) return null;

  if (!value.time) {
    const endOfDay = localMoment(value).endOf('day');
    if (now.isAfter(endOfDay)) {
      return completed ? 'past-complete' : 'past-incomplete';
    }
    return null;
  }

  const start = localMoment(value);
  const minutesUntil = start.diff(now, 'minutes', true);
  if (minutesUntil > 0 && minutesUntil < upcomingMinutes) return 'upcoming';

  const end = start
    .clone()
    .add(duration?.hours ?? 0, 'hours')
    .add(duration?.minutes ?? 0, 'minutes');
  if (now.isBetween(start, end)) return 'ongoing';
  if (now.isAfter(end)) return completed ? 'past-complete' : 'past-incomplete';
  return null;
}
