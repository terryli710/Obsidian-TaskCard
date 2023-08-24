import { DateOnly, TimeOnly } from '../taskModule/task';
import { logger } from '../utils/log';

export function displayDate(date: string): string {
  // the date string is local time.
  // if (!DateOnly.check(date)) return date;
  try {
    DateOnly.check(date);
  } catch (e) {
    return date;
  }

  // Convert UTC date to local time
  const inputDate = new Date(date);
  inputDate.setHours(0, 0, 0, 0);
  inputDate.setDate(inputDate.getDate() + 1);

  const currentDate = new Date();

  // Format the date as "Mon date" or "Mon date, year"
  let month = inputDate.toLocaleString('default', { month: 'short' });
  let datePart = inputDate.getDate();
  if (inputDate.getFullYear() !== currentDate.getFullYear()) {
    let year = inputDate.getFullYear();
    return `${month} ${datePart}, ${year}`;
  }

  // Check for yesterday, today, and tomorrow
  if (isYesterday(inputDate)) {
    return 'Yesterday';
  }
  if (isToday(inputDate)) {
    return 'Today';
  }
  if (isTomorrow(inputDate)) {
    return 'Tomorrow';
  }

  // Adjust the logic to determine if the date is within the current week, starting from Sun to Sat
  if (isSameWeek(inputDate, 0) === true) {
    return inputDate.toLocaleString('default', { weekday: 'short' });
  }

  return `${month} ${datePart}`;
}

export function displayTime(time: string): string {
  // the date string is local time.
  try {
    TimeOnly.check(time);
  } catch (e) {
    return time;
  }
  try {
    let [hours, minutes] = time.split(':');
    return `${parseInt(hours) % 12 || 12}:${minutes} ${
      parseInt(hours) >= 12 ? 'PM' : 'AM'
    }`;
  } catch (e) {
    return time;
  }
}

export function isYesterday(date: Date): boolean {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  );
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export function isTomorrow(date: Date): boolean {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate()
  );
}

export function isSameWeek(date: Date, weekStart: number = 0): boolean {
  const today = new Date();
  const inputDate = new Date(date); // Copy the input date to avoid modifying the original

  // Normalize both dates to the start of the week, based on the weekStart value
  today.setDate(today.getDate() - ((today.getDay() - weekStart + 7) % 7));
  inputDate.setDate(
    inputDate.getDate() - ((inputDate.getDay() - weekStart + 7) % 7)
  );

  // Compare the normalized dates
  return (
    today.getFullYear() === inputDate.getFullYear() &&
    today.getMonth() === inputDate.getMonth() &&
    today.getDate() === inputDate.getDate()
  );
}
