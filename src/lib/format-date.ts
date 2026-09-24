// Fixed locale and time zone, so the server render and the browser hydrate
// to the same string.
const displayDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Colombo",
});

/** "1 Sept 2026" style date for an ISO 8601 string. */
export function formatDisplayDate(iso: string): string {
  return displayDateFormatter.format(new Date(iso));
}
