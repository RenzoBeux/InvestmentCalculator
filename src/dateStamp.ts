/**
 * Shared date stamp and file names.
 *
 * Both the data export (JSON) and the PDF save files with today's date:
 * `plan-fire-2026-06-14.json` / `.pdf`. This is the single source of that
 * format, so the `pad`/`YYYY-MM-DD` isn't duplicated in each place.
 */

/** Date in local short ISO format: `2026-06-14`. */
export function dateStamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Plan file name with the date: `plan-fire-2026-06-14.<ext>`. */
export function planFileName(ext: "json" | "pdf", date = new Date()): string {
  return `plan-fire-${dateStamp(date)}.${ext}`;
}
