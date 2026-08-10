import moment from 'moment';
import {
  inputHasExplicitTime,
  parseScheduleInput
} from '../src/taskModule/temporal';
import {
  getTemporalPresentation,
  getTemporalStatus
} from '../src/utils/temporalDisplay';

describe('temporal resolution', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-10T19:00:00'));
  });

  afterEach(() => jest.useRealTimers());

  it('distinguishes a day-only phrase from an explicit midnight instant', () => {
    expect(parseScheduleInput('tomorrow')).toEqual({
      isRecurring: false,
      date: '2026-07-11',
      string: '2026-07-11'
    });
    expect(parseScheduleInput('tomorrow at midnight')).toEqual({
      isRecurring: false,
      date: '2026-07-11',
      time: '00:00',
      string: '2026-07-11T00:00'
    });
    expect(parseScheduleInput('tomorrow at 23:59')).toEqual({
      isRecurring: false,
      date: '2026-07-11',
      time: '23:59',
      string: '2026-07-11T23:59'
    });
  });

  it('preserves minute resolution in canonical midnight values', () => {
    expect(parseScheduleInput('2026-07-11T00:00')).toEqual({
      isRecurring: false,
      date: '2026-07-11',
      time: '00:00',
      string: '2026-07-11T00:00'
    });
    expect(inputHasExplicitTime('Friday at noon')).toBe(true);
    expect(inputHasExplicitTime('Friday')).toBe(false);
  });
});

describe('48-hour hybrid presentation', () => {
  const now = moment('2026-07-10T19:00');

  it('keeps day-only values at calendar-day resolution', () => {
    expect(
      getTemporalPresentation(
        { isRecurring: false, date: '2026-07-11', string: '2026-07-11' },
        'due',
        now
      )
    ).toEqual({
      text: 'Tomorrow',
      tooltip: 'Any time on Sat, Jul 11'
    });
  });

  it('uses relative text for near exact instants, including midnight', () => {
    const midnight = {
      isRecurring: false,
      date: '2026-07-11',
      time: '00:00',
      string: '2026-07-11T00:00'
    };
    expect(getTemporalPresentation(midnight, 'due', now)).toEqual({
      text: 'in 5 hours',
      tooltip: 'Sat, Jul 11 · 12:00 AM'
    });

    const past = { ...midnight, date: '2026-07-10', time: '14:00' };
    expect(getTemporalPresentation(past, 'due', now).text).toBe('5 hours overdue');
    expect(getTemporalPresentation(past, 'scheduled', now).text).toBe('5 hours ago');
  });

  it('uses an absolute local date and time beyond 48 hours', () => {
    expect(
      getTemporalPresentation(
        {
          isRecurring: false,
          date: '2026-07-16',
          time: '09:00',
          string: '2026-07-16T09:00'
        },
        'scheduled',
        now
      )
    ).toEqual({
      text: 'Thu, Jul 16 · 9:00 AM',
      tooltip: 'Thu, Jul 16 · 9:00 AM'
    });
  });

  it('does not mark a day-only value past until its local day ends', () => {
    const dayOnly = {
      isRecurring: false,
      date: '2026-07-11',
      string: '2026-07-11'
    };
    expect(getTemporalStatus(dayOnly, null, false, moment('2026-07-11T23:59'))).toBeNull();
    expect(
      getTemporalStatus(dayOnly, null, false, moment('2026-07-12T00:00'))
    ).toBe('past-incomplete');
  });
});
