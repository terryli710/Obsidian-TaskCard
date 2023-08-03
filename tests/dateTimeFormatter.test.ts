import { logger } from '../src/log';
import { displayDate, displayTime, isSameWeek, isToday, isTomorrow, isYesterday } from '../src/utils/dateTimeFormatter';


describe('displayDate', () => {
  it('returns "Today" for the current date', () => {
    const date = new Date();
    const dateString = getLocalISODate(date);
    expect(displayDate(dateString)).toBe('Today');
  });

  it('returns "Tomorrow" for the next day', () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    const dateString = getLocalISODate(date);
    expect(displayDate(dateString)).toBe('Tomorrow');
  });

  it('returns "Yesterday" for the previous day', () => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const dateString = getLocalISODate(date);
    expect(displayDate(dateString)).toBe('Yesterday');
  });

  it('returns the weekday for a date within the same week', () => {
    const date = new Date();
    date.setDate(date.getDate() + 3); // Adjust as needed for your test scenario
    const dateString = getLocalISODate(date);
    const expectedWeekday = date.toLocaleString('default', { weekday: 'short' });
    expect(displayDate(dateString)).toBe(expectedWeekday);
  });

  it('returns the correct month and date for the same year', () => {
    const date = new Date(fixedDate());
    date.setMonth(date.getMonth() + 2); // Move to a different month
    const expectedFormat = `${date.toLocaleString('default', { month: 'short' })} ${date.getDate()}`;
    const dateString = getLocalISODate(date);
    expect(displayDate(dateString)).toBe(expectedFormat);
  });

  it('returns the correct month, date, and year for a different year', () => {
    const date = new Date(fixedDate());
    date.setFullYear(date.getFullYear() + 1); // Move to next year
    const expectedFormat = `${date.toLocaleString('default', { month: 'short' })} ${date.getDate()}, ${date.getFullYear()}`;
    const dateString = getLocalISODate(date);
    expect(displayDate(dateString)).toBe(expectedFormat);
  });

  it('returns the original string if it does not pass DateOnly.check', () => {
    const date = 'Not a date';
    expect(displayDate(date)).toBe(date);
  });
});

describe('isYesterday', () => {
  it('returns true if the date is yesterday', () => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    expect(isYesterday(date)).toBe(true);
  });

  it('returns false if the date is not yesterday', () => {
    const date = new Date();
    expect(isYesterday(date)).toBe(false);
  });
});

describe('isToday', () => {
  it('returns true if the date is today', () => {
    const date = new Date();
    expect(isToday(date)).toBe(true);
  });

  it('returns false if the date is not today', () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    expect(isToday(date)).toBe(false);
  });
});

describe('isTomorrow', () => {
  it('returns true if the date is tomorrow', () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    expect(isTomorrow(date)).toBe(true);
  });

  it('returns false if the date is not tomorrow', () => {
    const date = new Date();
    expect(isTomorrow(date)).toBe(false);
  });
});

describe('isSameWeek', () => {
  it('returns true if the date is within the same week', () => {
    const today = new Date();
    const date = new Date(today);
    date.setDate(today.getDate() - today.getDay()); // Set to the start of the week
    expect(isSameWeek(date)).toBe(true);
  });

  it('returns false if the date is not within the same week', () => {
    const today = new Date();
    const date = new Date(today);
    date.setDate(today.getDate() - today.getDay() - 1); // Set to the day before the start of the week
    expect(isSameWeek(date)).toBe(false);
  });

  it('considers the week start day if provided', () => {
    const today = new Date();
    const date = new Date(today);
    date.setDate(today.getDate() - today.getDay() + 1); // Set to Monday
    expect(isSameWeek(date, 1)).toBe(true); // Should be true if the week starts on Monday
  });
});


describe('displayTime', () => {
  test('should return undefined when time is undefined', () => {
    expect(displayTime(undefined)).toBe(undefined);
  });

  test('should convert midnight to 12:00 AM', () => {
    expect(displayTime('00:00')).toBe('12:00 AM');
  });

  test('should convert noon to 12:00 PM', () => {
    expect(displayTime('12:00')).toBe('12:00 PM');
  });

  test('should correctly format morning time', () => {
    expect(displayTime('09:30')).toBe('9:30 AM');
  });

  test('should correctly format afternoon time', () => {
    expect(displayTime('15:45')).toBe('3:45 PM');
  });

  // You might also want to test for invalid input
  test('should handle invalid time', () => {
    // Behavior here is not defined by the given function, so you'll need to decide what is expected.
    // It could be to return null, or the original string, or something else.
    // Here's an example expecting the original string:
    expect(displayTime('invalid-input')).toBe('invalid-input');
  });
});



function fixedDate(): string | number | Date {
  // return the Mar 3 of this year
  const currentYear = new Date().getFullYear();
  return new Date(currentYear, 3, 3);
}


function getLocalISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateString = `${year}-${month}-${day}`;
  return dateString;
}