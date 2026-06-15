/**
 * Share the plan via link: encodes the whole plan into the URL hash, so you can
 * copy a link instead of a file. Reuses the same serializer and validator as the
 * JSON export. `parsePlanData` is the security boundary: a malicious, old, or
 * broken link degrades to the default values, exactly like an imported file.
 */
import {
  buildExportFile,
  parsePlanData,
  type ImportResult,
  type PlanData,
} from "./exportData";

/** Hash marker for a shared plan: `#plan=...`. */
const HASH_KEY = "plan";

// btoa/atob only handle bytes (Latin-1); the JSON may contain accented characters.
// We go through UTF-8 and use base64url so the hash travels intact through chats and links.
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

/** Encodes the plan into a string suitable for the URL hash. */
export function encodePlanToHash(data: PlanData): string {
  return toBase64Url(JSON.stringify(buildExportFile(data)));
}

/** Full share URL, derived from the current one. */
export function buildShareUrl(
  data: PlanData,
  base = window.location.href
): string {
  const url = new URL(base);
  url.hash = `${HASH_KEY}=${encodePlanToHash(data)}`;
  return url.toString();
}

/**
 * Extracts and validates a plan from the hash, if present. Returns null if the
 * hash carries no plan; an ImportResult (ok/error) if it does.
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
