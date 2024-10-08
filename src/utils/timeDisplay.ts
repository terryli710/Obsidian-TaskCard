import moment from 'moment';

export function getRelativeTimeDisplay(dateTime: moment.Moment): string {
  const now = moment();
  const diff = moment.duration(dateTime.diff(now));

  const units = [
    { unit: 'year', method: 'years' },
    { unit: 'month', method: 'months' },
    { unit: 'day', method: 'days' },
    { unit: 'hour', method: 'hours' },
    { unit: 'minute', method: 'minutes' },
    { unit: 'second', method: 'seconds' }
  ];

  let prefix = 'in ';
  let suffix = '';

  if (dateTime.isBefore(now)) {
    prefix = '';
    suffix = ' ago';
  }

  for (let i = 0; i < units.length; i++) {
    const { unit, method } = units[i];
    const value = Math.abs(diff[method]());

    if (value >= 1) {
      if (i === units.length - 1 || value > 1 || (i + 1 < units.length && Math.abs(diff[units[i + 1].method]()) === 0)) {
        const pluralSuffix = value !== 1 ? 's' : '';
        return `${prefix}${Math.floor(value)} ${unit}${pluralSuffix}${suffix}`;
      }

      if (i + 1 < units.length) {
        const nextUnit = units[i + 1];
        const nextValue = Math.abs(diff[nextUnit.method]());

        if (nextValue > 0) {
          const pluralSuffix1 = Math.floor(value) !== 1 ? 's' : '';
          const pluralSuffix2 = nextValue !== 1 ? 's' : '';
          return `${prefix}${Math.floor(value)} ${unit}${pluralSuffix1} and ${nextValue} ${nextUnit.unit}${pluralSuffix2}${suffix}`;
        }
      }
    }
  }

  return 'just now';
}

export function getAbsoluteTimeDisplay(dateTime: moment.Moment): string {
  const now = moment();
  const diff = moment.duration(dateTime.diff(now));

  if (diff.asYears() > 1) {
    return dateTime.format('YYYY');
  } else if (diff.asYears() === 1) {
    return dateTime.format('MMM, YYYY');
  } else if (diff.asMonths() > 0) {
    return dateTime.format('MMM DD');
  } else if (diff.asWeeks() > 0) {
    return `next ${dateTime.format('ddd, MMM DD')}`;
  } else if (diff.asDays() > 1 || (diff.asDays() === 1 && diff.asHours() >= 24)) {
    return dateTime.format('ddd, MMM DD, hA');
  } else if (diff.asDays() === 1) {
    return 'Tomorrow';
  } else {
    return dateTime.format('h:mmA');
  }
}