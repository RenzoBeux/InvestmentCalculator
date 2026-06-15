/**
 * Compartir el plan por enlace: codifica todo el plan en el hash de la URL, así
 * se puede copiar un link en vez de un archivo. Reutiliza el mismo serializador
 * y validador que la exportación a JSON. `parsePlanData` es la frontera de
 * seguridad: un enlace malicioso, viejo o roto degrada a los valores por
 * defecto, exactamente igual que un archivo importado.
 */
import {
  buildExportFile,
  parsePlanData,
  type ImportResult,
  type PlanData,
} from "./exportData";

/** Marca del hash de un plan compartido: `#plan=...`. */
const HASH_KEY = "plan";

// btoa/atob solo manejan bytes (Latin-1); el JSON puede tener acentos. Pasamos
// por UTF-8 y usamos base64url para que el hash viaje intacto por chats y links.
function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(b64u: string): string {
  const b64 = b64u.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  const bin = atob(b64 + pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Codifica el plan a un string apto para el hash de la URL. */
export function encodePlanToHash(data: PlanData): string {
  return toBase64Url(JSON.stringify(buildExportFile(data)));
}

/** URL completa para compartir, a partir de la actual. */
export function buildShareUrl(
  data: PlanData,
  base = window.location.href
): string {
  const url = new URL(base);
  url.hash = `${HASH_KEY}=${encodePlanToHash(data)}`;
  return url.toString();
}

/**
 * Extrae y valida un plan del hash, si lo hay. Devuelve null si el hash no trae
 * un plan; un ImportResult (ok/error) si lo trae.
 */
export function readPlanFromHash(
  hash = window.location.hash
): ImportResult | null {
  const raw = hash.replace(/^#/, "");
  if (!raw.startsWith(`${HASH_KEY}=`)) return null;
  const encoded = raw.slice(HASH_KEY.length + 1);
  if (!encoded) return null;
  let json: string;
  try {
    json = fromBase64Url(encoded);
  } catch {
    return { ok: false, error: "El enlace no contiene un plan válido." };
  }
  return parsePlanData(json);
}
