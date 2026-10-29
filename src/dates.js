function calendar(year, month, day) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  const valid = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
  return valid ? date.getTime() : NaN;
}

export const temporal = field => ['date', 'datetime'].includes(field?.kind);

function timestamp(day, time) {
  const parts = /^(\d\d):(\d\d)(?::(\d\d)(\.\d{1,9})?)?(Z|[+-]\d\d:\d\d)?$/.exec(time);
  if (!parts || Number(parts[1]) > 23 || Number(parts[2]) > 59 || Number(parts[3] ?? 0) > 59) { return NaN; }
  return Date.parse(`${day}T${time}${parts[5] ? '' : 'Z'}`);
}

function declaredDate(value, format) {
  if (!['%d/%m/%Y', '%d/%m/%Y %H:%M:%S'].includes(format)) { return NaN; }
  const parts = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: (\d\d:\d\d:\d\d))?$/.exec(value);
  if (!parts) { return NaN; }
  const day = calendar(Number(parts[3]), Number(parts[2]), Number(parts[1]));
  if (!Number.isFinite(day) || !parts[4]) { return day; }
  return timestamp(new Date(day).toISOString().slice(0, 10), parts[4]);
}

export function dateNumber(value, format) {
  if (typeof value !== 'string') { return NaN; }
  const iso = /^(\d{4})-(\d\d)-(\d\d)(?:[T ](.+))?$/.exec(value);
  if (iso) {
    const day = calendar(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (!Number.isFinite(day) || !iso[4]) { return day; }
    return timestamp(value.slice(0, 10), iso[4].replace(/ UTC$/, 'Z'));
  }
  const dotted = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value);
  if (!dotted) { return declaredDate(value, format); }
  return calendar(Number(dotted[3]), Number(dotted[2]), Number(dotted[1]));
}
