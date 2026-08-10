const swedishWeekday = new Intl.DateTimeFormat('sv-SE', { weekday: 'long' });
const swedishDate = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'long' });

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function endOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPlayDayKey(date: Date) {
  return toDateKey(startOfLocalDay(date));
}

export function getPlayRoundInfo(date: Date) {
  const day = startOfLocalDay(date);
  const weekday = day.getDay();
  const saturday = weekday === 0 ? addDays(day, -1) : weekday === 6 ? day : day;
  const sunday = addDays(saturday, 1);
  const saturdayKey = toDateKey(saturday);
  const sundayKey = toDateKey(sunday);

  return {
    roundKey: `${saturdayKey}_${sundayKey}`,
    title: `Omgång ${saturdayKey}`,
    startsOn: saturday,
    endsOn: sunday,
  };
}

export function getAbsenceDeadline(startsOn: Date) {
  return endOfLocalDay(addDays(startOfLocalDay(startsOn), -7));
}

export function isAbsenceDeadlinePassed(startsOn: Date, now = new Date()) {
  return now.getTime() > getAbsenceDeadline(startsOn).getTime();
}

export function formatPlayDayTitle(date: Date) {
  const weekday = swedishWeekday.format(date);
  const dateText = swedishDate.format(date);

  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${dateText}`;
}
