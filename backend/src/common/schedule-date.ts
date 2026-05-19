export type ScheduleTimingUnit = 'weeks' | 'months' | 'years';

type ScheduleTiming = {
  unit: ScheduleTimingUnit;
  value: number;
};

const TIMING_PATTERN = /^(week|month|year)s?\s+(\d+)$/i;

const getDaysInMonth = (year: number, month: number) =>
  new Date(year, month + 1, 0).getDate();

const addMonths = (date: Date, months: number) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const targetMonth = month + months;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const daysInTargetMonth = getDaysInMonth(targetYear, normalizedMonth);
  return new Date(targetYear, normalizedMonth, Math.min(day, daysInTargetMonth));
};

const addWeeks = (date: Date, weeks: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + weeks * 7);
  return next;
};

const addYears = (date: Date, years: number) => addMonths(date, years * 12);

export const parseScheduleTiming = (scheduleName?: string | null): ScheduleTiming | null => {
  if (!scheduleName) return null;
  const normalized = scheduleName.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.startsWith('at birth')) {
    return { unit: 'weeks', value: 0 };
  }
  const match = normalized.match(TIMING_PATTERN);
  if (!match) return null;
  const unit = match[1].toLowerCase() as ScheduleTimingUnit;
  const value = Number.parseInt(match[2], 10);
  if (Number.isNaN(value) || value < 0) return null;
  return { unit, value };
};

export const getDueDateFromSchedule = (
  dateOfBirth: string,
  scheduleName: string | null | undefined,
  fallbackDueDays: number,
) => {
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) {
    return new Date(dateOfBirth);
  }

  const timing = parseScheduleTiming(scheduleName);
  if (!timing) {
    const fallback = new Date(birthDate);
    fallback.setDate(fallback.getDate() + fallbackDueDays);
    return fallback;
  }

  switch (timing.unit) {
    case 'months':
      return addMonths(birthDate, timing.value);
    case 'years':
      return addYears(birthDate, timing.value);
    case 'weeks':
    default:
      return addWeeks(birthDate, timing.value);
  }
};

export const getDueDaysFromSchedule = (
  dateOfBirth: string,
  scheduleName: string | null | undefined,
  fallbackDueDays: number,
) => {
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) {
    return fallbackDueDays;
  }
  const dueDate = getDueDateFromSchedule(dateOfBirth, scheduleName, fallbackDueDays);
  return Math.floor((dueDate.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));
};
