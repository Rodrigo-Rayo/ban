/**
 * Today's date as YYYY-MM-DD in the user's local time zone.
 * `new Date().toISOString()` is UTC, which in Spain is still "yesterday"
 * between 00:00 and 01:00/02:00 local time.
 */
export function localToday(now: Date = new Date()): string {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
