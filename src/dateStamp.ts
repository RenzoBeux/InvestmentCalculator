/**
 * Sello de fecha y nombres de archivo compartidos.
 *
 * Tanto la exportación de datos (JSON) como el PDF guardan archivos con la fecha
 * de hoy: `plan-fire-2026-06-14.json` / `.pdf`. Esta es la única fuente de ese
 * formato, así no se duplica el `pad`/`YYYY-MM-DD` en cada lugar.
 */

/** Fecha en formato ISO corto local: `2026-06-14`. */
export function dateStamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Nombre de archivo del plan con la fecha: `plan-fire-2026-06-14.<ext>`. */
export function planFileName(ext: "json" | "pdf", date = new Date()): string {
  return `plan-fire-${dateStamp(date)}.${ext}`;
}
