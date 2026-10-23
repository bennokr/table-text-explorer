function calendar(year, month, day) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  const valid = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
  return valid ? date.getTime() : NaN;
}

export function dateNumber(value) {
  if (typeof value !== 'string') { return NaN; }
  const iso = /^(\d{4})-(\d\d)-(\d\d)(T.*)?$/.exec(value);
  if (iso) {
    const day = calendar(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    return iso[4] && Number.isFinite(day) ? Date.parse(value) : day;
  }
  const dotted = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value);
  if (!dotted) { return NaN; }
  return calendar(Number(dotted[3]), Number(dotted[2]), Number(dotted[1]));
}
