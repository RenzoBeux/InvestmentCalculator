/**
 * Export and import the user's plan as a JSON file.
 *
 * "Save the data" = download everything the user entered (inputs, assumptions,
 * currency, and age) to a file, so it can be loaded again later or on another
 * machine. Importing is defensive: it validates and sanitizes every field against
 * the default values, so an old, partial, or hand-edited file never breaks the
 * app — at worst it falls back to the defaults.
 *
 * This file is pure and typed except for the download/read helpers, which
 * touch the browser DOM. It does not depend on React.
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
 * File schema version. Bump it when the shape of the data changes.
 * v2: added `monthlyGrowth` and `coastTargetAge` to the inputs.
 * v3: added `solveFor` (auto-calc mode). v1/v2 files still load:
 * the new fields fall back to their default values ("timeline").
 */
export const EXPORT_VERSION = 3;

const APP_MARKER = "planificador-fire";

/** Everything the user configures that we want to be able to save/restore. */
export interface PlanData {
  inputs: PlanInputs;
  assumptions: Assumptions;
  currency: string;
  currentAge: number;
}

/** Shape of the file on disk: the data plus metadata to identify it. */
export interface ExportFile extends PlanData {
  app: typeof APP_MARKER;
  version: number;
  exportedAt: string;
}

export type ImportResult =
  | { ok: true; data: PlanData }
  | { ok: false; error: string };

/** Wraps the data with the file metadata (marker, version, date). */
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

/** File name with date: `plan-fire-2026-06-14.json`. */
export function exportFileName(date = new Date()): string {
  return planFileName("json", date);
}

/** Generates the JSON and triggers the download in the browser. */
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

/** Reads a `File` as text (wraps FileReader in a promise). */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsText(file);
  });
}

/** Parses and sanitizes the text of an imported file. Never throws: returns ok/error. */
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

// --------------------------------------------------------------- sanitizers ---

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function sanitizePlanData(obj: Record<string, unknown>): PlanData | null {
  // We require a strong signal that this is a plan and not just any JSON:
  // either the app marker, or at least two fields with the expected shape. That way
  // a file with a single stray field (e.g. `{ "currency": "x" }`) isn't
  // mistaken for a plan and ends up overwriting everything with the default values.
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
    // Whitelist, not num(): anything outside the union falls back to "timeline".
    solveFor:
      o.solveFor === "monthly" || o.solveFor === "initial"
        ? o.solveFor
        : DEFAULT_INPUTS.solveFor,
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
