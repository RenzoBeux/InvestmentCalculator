/**
 * Exportar e importar el plan del usuario como un archivo JSON.
 *
 * "Guardar los datos" = bajar todo lo que el usuario cargó (inputs, supuestos,
 * moneda y edad) a un archivo, para poder volver a cargarlo más tarde o en otra
 * compu. La importación es defensiva: valida y sanea cada campo contra los
 * valores por defecto, así un archivo viejo, parcial o tocado a mano nunca rompe
 * la app — a lo sumo cae a los defaults.
 *
 * Este archivo es puro y tipado salvo por los helpers de descarga/lectura, que
 * tocan el DOM del navegador. No depende de React.
 */

import {
  ALLOCATIONS,
  DEFAULT_AGE,
  DEFAULT_ASSUMPTIONS,
  DEFAULT_INPUTS,
  type Allocation,
  type Assumptions,
  type PlanInputs,
} from "./finance";
import { CURRENCIES, DEFAULT_CURRENCY } from "./format";
import { planFileName } from "./dateStamp";

/**
 * Versión del esquema del archivo. Subila si cambia la forma de los datos.
 * v2: se agregaron `monthlyGrowth` y `coastTargetAge` a los inputs. Los archivos
 * v1 siguen cargando: los campos nuevos caen a sus valores por defecto.
 */
export const EXPORT_VERSION = 2;

const APP_MARKER = "planificador-fire";

/** Todo lo que el usuario configura y queremos poder guardar/restaurar. */
export interface PlanData {
  inputs: PlanInputs;
  assumptions: Assumptions;
  currency: string;
  currentAge: number;
}

/** Forma del archivo en disco: los datos más metadatos para identificarlo. */
export interface ExportFile extends PlanData {
  app: typeof APP_MARKER;
  version: number;
  exportedAt: string;
}

export type ImportResult =
  | { ok: true; data: PlanData }
  | { ok: false; error: string };

/** Envuelve los datos con los metadatos del archivo (marca, versión, fecha). */
export function buildExportFile(data: PlanData): ExportFile {
  return {
    app: APP_MARKER,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    inputs: data.inputs,
    assumptions: data.assumptions,
    currency: data.currency,
    currentAge: data.currentAge,
  };
}

/** Nombre de archivo con fecha: `plan-fire-2026-06-14.json`. */
export function exportFileName(date = new Date()): string {
  return planFileName("json", date);
}

/** Genera el JSON y dispara la descarga en el navegador. */
export function downloadPlanData(data: PlanData): void {
  const json = JSON.stringify(buildExportFile(data), null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Lee un `File` como texto (envuelve FileReader en una promesa). */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsText(file);
  });
}

/** Parsea y sanea el texto de un archivo importado. Nunca tira: devuelve ok/error. */
export function parsePlanData(raw: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "El archivo no es un JSON válido." };
  }
  if (!isRecord(parsed)) {
    return { ok: false, error: "El archivo no tiene el formato esperado." };
  }
  if (typeof parsed.version === "number" && parsed.version > EXPORT_VERSION) {
    return {
      ok: false,
      error: "Este archivo se exportó con una versión más nueva de la app.",
    };
  }
  const data = sanitizePlanData(parsed);
  if (!data) {
    return {
      ok: false,
      error: "El archivo no parece ser un plan exportado desde acá.",
    };
  }
  return { ok: true, data };
}

// --------------------------------------------------------------- saneadores ---

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function sanitizePlanData(obj: Record<string, unknown>): PlanData | null {
  // Exigimos una señal fuerte de que esto es un plan y no un JSON cualquiera:
  // o bien la marca de la app, o al menos dos campos con la forma esperada. Así
  // un archivo con un solo campo suelto (p. ej. `{ "currency": "x" }`) no se
  // toma por un plan y termina pisando todo con los valores por defecto.
  const signals = [
    isRecord(obj.inputs),
    isRecord(obj.assumptions),
    typeof obj.currency === "string",
    typeof obj.currentAge === "number",
  ].filter(Boolean).length;
  if (obj.app !== APP_MARKER && signals < 2) return null;

  return {
    inputs: sanitizeInputs(obj.inputs),
    assumptions: sanitizeAssumptions(obj.assumptions),
    currency: sanitizeCurrency(obj.currency),
    currentAge: clampAge(num(obj.currentAge, DEFAULT_AGE)),
  };
}

function sanitizeInputs(v: unknown): PlanInputs {
  const o = isRecord(v) ? v : {};
  return {
    initial: Math.max(0, num(o.initial, DEFAULT_INPUTS.initial)),
    monthly: Math.max(0, num(o.monthly, DEFAULT_INPUTS.monthly)),
    monthlyGrowth: Math.max(
      -0.5,
      Math.min(1, num(o.monthlyGrowth, DEFAULT_INPUTS.monthlyGrowth))
    ),
    monthlySpend: Math.max(0, num(o.monthlySpend, DEFAULT_INPUTS.monthlySpend)),
    withdrawalRate: Math.max(
      0,
      num(o.withdrawalRate, DEFAULT_INPUTS.withdrawalRate)
    ),
    retirementAllocation: isAllocation(o.retirementAllocation)
      ? o.retirementAllocation
      : DEFAULT_INPUTS.retirementAllocation,
    customRetirementReturn: num(
      o.customRetirementReturn,
      DEFAULT_INPUTS.customRetirementReturn
    ),
    coastTargetAge: clampAge(
      num(o.coastTargetAge, DEFAULT_INPUTS.coastTargetAge)
    ),
  };
}

function sanitizeAssumptions(v: unknown): Assumptions {
  const o = isRecord(v) ? v : {};
  const ret = isRecord(o.retirementReturns) ? o.retirementReturns : {};
  const d = DEFAULT_ASSUMPTIONS;
  return {
    returnMode: o.returnMode === "nominal" ? "nominal" : "real",
    inflation: Math.max(0, num(o.inflation, d.inflation)),
    accumulationReturn: num(o.accumulationReturn, d.accumulationReturn),
    retirementReturns: {
      aggressive: num(ret.aggressive, d.retirementReturns.aggressive),
      balanced: num(ret.balanced, d.retirementReturns.balanced),
      conservative: num(ret.conservative, d.retirementReturns.conservative),
    },
    maxAccumulationYears: Math.max(
      1,
      Math.round(num(o.maxAccumulationYears, d.maxAccumulationYears))
    ),
    retirementChartYears: Math.max(
      1,
      Math.round(num(o.retirementChartYears, d.retirementChartYears))
    ),
  };
}

function sanitizeCurrency(v: unknown): string {
  return typeof v === "string" && CURRENCIES.some((c) => c.code === v)
    ? v
    : DEFAULT_CURRENCY;
}

function clampAge(v: number): number {
  return Math.min(100, Math.max(0, Math.round(v)));
}

function isAllocation(v: unknown): v is Allocation {
  return (
    typeof v === "string" &&
    ((ALLOCATIONS as string[]).includes(v) || v === "custom")
  );
}
