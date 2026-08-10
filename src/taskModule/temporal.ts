import Sugar from 'sugar';
import { formatScheduleValue, parseIsoScheduleValue } from './fieldSyntax';
import type { ScheduleDate } from './task';

/**
 * Whether the input names a clock time, rather than only a calendar day.
 *
 * This must be derived from the input text, not from Sugar's resulting clock:
 * Sugar represents several day-only phrases at 00:00 or 23:59, while those
 * same clocks can also be exact user-authored instants.
 */
export function inputHasExplicitTime(rawValue: string): boolean {
  const value = rawValue.trim();
  if (!value) return false;

  return (
    /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value) ||
    /\b\d{1,2}:\d{2}\s*(?:a\.?m\.?|p\.?m\.?)?\b/i.test(value) ||
    /\b\d{1,2}\s*(?:a\.?m\.?|p\.?m\.?)\b/i.test(value) ||
    /\bat\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?\b/i.test(value) ||
    /\b(?:noon|midnight)\b/i.test(value)
  );
}

/**
 * Parse either TaskCard's canonical local-date grammar or a natural-language
 * input. Natural language is resolved once and immediately canonicalized.
 */
export function parseScheduleInput(rawValue: string): ScheduleDate | null {
  const value = rawValue.trim();
  if (!value) return null;

  // The canonical grammar is unambiguous: the presence of T/space + HH:mm
  // itself carries minute resolution, including exact midnight and 23:59.
  const canonical = parseIsoScheduleValue(value);
  if (canonical) return canonical;

  // Sugar interprets "tomorrow at midnight" as midnight at the *end* of
  // tomorrow (the following calendar date). TaskCard treats the named day as
  // authoritative and midnight/noon as its exact clock, matching canonical
  // `tomorrow-date T00:00` semantics.
  const namedTime = value.match(/\b(?:at\s+)?(midnight|noon)\b/i);
  if (namedTime) {
    const dayExpression = `${value.slice(0, namedTime.index ?? 0)} ${value.slice(
      (namedTime.index ?? 0) + namedTime[0].length
    )}`.trim();
    if (dayExpression) {
      const parsedDay = Sugar.Date.create(dayExpression);
      if (parsedDay && Sugar.Date.isValid(parsedDay)) {
        const schedule = {
          isRecurring: false,
          date: Sugar.Date.format(parsedDay, '{yyyy}-{MM}-{dd}'),
          time: namedTime[1].toLowerCase() === 'midnight' ? '00:00' : '12:00'
        } as ScheduleDate;
        schedule.string = formatScheduleValue(schedule);
        return schedule;
      }
    }
  }

  const parsed = Sugar.Date.create(value);
  if (!parsed || !Sugar.Date.isValid(parsed)) return null;

  const schedule = {
    isRecurring: false,
    date: Sugar.Date.format(parsed, '{yyyy}-{MM}-{dd}'),
    ...(inputHasExplicitTime(value)
      ? { time: Sugar.Date.format(parsed, '{HH}:{mm}') }
      : {})
  } as ScheduleDate;

  // Phrases such as "tomorrow" are an input method, not persisted state.
  // Freezing the resolved value prevents it from drifting on later parses.
  schedule.string = formatScheduleValue(schedule);
  return schedule;
}
