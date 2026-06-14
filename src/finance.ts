/**
 * Lógica financiera del planificador de retiro.
 *
 * Todo se calcula en términos REALES (dólares de hoy): el rendimiento ya viene
 * con la inflación descontada y el gasto se mantiene constante en poder de compra.
 * Es la única forma honesta de proyectar varias décadas.
 *
 * Este archivo es puro y tipado: no toca el DOM ni React, así que es el lugar
 * para mejorar el modelo (ver README → "Ideas para mejorarlo").
 */

export type Allocation = "aggressive" | "balanced" | "conservative";

/** Rendimiento real anual mientras acumulás (se asume 100% en el ETF global). */
export const ACCUMULATION_REAL_RETURN = 0.06;

/** Rendimiento real anual durante el retiro, según la cartera elegida. */
export const RETIREMENT_REAL_RETURNS: Record<Allocation, number> = {
  aggressive: 0.06, // 100% acciones
  balanced: 0.045, // 60 / 40
  conservative: 0.035, // 40 / 60
};

export const ALLOCATION_LABELS: Record<Allocation, string> = {
  aggressive: "100% acciones",
  balanced: "60 / 40",
  conservative: "40 / 60",
};

const ACCUMULATION_MAX_YEARS = 60;
const RETIREMENT_CHART_YEARS = 45;

export type Trend = "grow" | "flat" | "decline";

export interface PlanInputs {
  /** Inversión inicial, en dólares de hoy. */
  initial: number;
  /** Aporte mensual, en dólares de hoy. */
  monthly: number;
  /** Gasto mensual deseado en el retiro, en dólares de hoy. */
  monthlySpend: number;
  /** Tasa de retiro segura (p. ej. 0.04 = 4%). */
  withdrawalRate: number;
  /** Asignación de la cartera durante el retiro. */
  retirementAllocation: Allocation;
}

export interface LifecycleResult {
  /** Cartera objetivo = gasto anual / tasa de retiro. */
  fireNumber: number;
  /** ¿Se alcanza el objetivo dentro del horizonte de acumulación? */
  reached: boolean;
  /** Años de aportes hasta alcanzar el número de retiro. */
  accumulationYears: number;
  /** Saldo al final de cada año de acumulación (índice 0..accumulationYears). */
  accumulationSeries: number[];
  /** Rendimiento real aplicado en el retiro. */
  retirementReturn: number;
  /** Saldo al inicio del retiro y al final de cada año (índice 0..n). */
  retirementSeries: number[];
  /** Si la cartera crece, se mantiene o se agota durante el retiro. */
  trend: Trend;
  /** Años dentro del retiro hasta agotarse (solo si la tendencia es "decline"). */
  depletionYear: number | null;
}

/** Número de retiro: cuánto capital necesitás para vivir de la cartera. */
export function fireNumber(monthlySpend: number, withdrawalRate: number): number {
  if (withdrawalRate <= 0) return Infinity;
  return (Math.max(0, monthlySpend) * 12) / withdrawalRate;
}

/**
 * Simula el ciclo completo: acumulación (capitalización mensual) hasta el número
 * de retiro, y luego el retiro (retiros anuales) con la cartera elegida.
 */
export function computeLifecycle(inputs: PlanInputs): LifecycleResult {
  const initial = Math.max(0, inputs.initial);
  const monthly = Math.max(0, inputs.monthly);
  const annualSpend = Math.max(0, inputs.monthlySpend) * 12;
  const target = fireNumber(inputs.monthlySpend, inputs.withdrawalRate);
  const retirementReturn = RETIREMENT_REAL_RETURNS[inputs.retirementAllocation];

  // --- Fase de acumulación ---
  const monthlyRate = ACCUMULATION_REAL_RETURN / 12;
  const accumulationSeries: number[] = [initial];
  let balance = initial;
  let accumulationYears = 0;
  let reached = balance >= target;

  if (!reached) {
    for (let month = 1; month <= ACCUMULATION_MAX_YEARS * 12; month++) {
      balance = balance * (1 + monthlyRate) + monthly;
      if (month % 12 === 0) {
        accumulationSeries.push(balance);
        if (balance >= target) {
          accumulationYears = month / 12;
          reached = true;
          break;
        }
      }
    }
  }

  if (!reached) {
    return {
      fireNumber: target,
      reached: false,
      accumulationYears: accumulationSeries.length - 1,
      accumulationSeries,
      retirementReturn,
      retirementSeries: [],
      trend: "decline",
      depletionYear: null,
    };
  }

  // --- Fase de retiro ---
  // El saldo evoluciona como bal_{n+1} = bal_n * (1 + r) - gasto.
  // Su punto de equilibrio es gasto / r: por encima crece, por debajo se agota.
  const start = accumulationSeries[accumulationSeries.length - 1];
  const fixedPoint = retirementReturn > 0 ? annualSpend / retirementReturn : Infinity;

  let trend: Trend;
  let depletionYear: number | null = null;

  if (start > fixedPoint + 1) {
    trend = "grow";
  } else if (Math.abs(start - fixedPoint) <= 1) {
    trend = "flat";
  } else {
    trend = "decline";
    depletionYear = Math.ceil(
      Math.log(fixedPoint / (fixedPoint - start)) / Math.log(1 + retirementReturn)
    );
  }

  const chartLimit = Math.min(RETIREMENT_CHART_YEARS, depletionYear ?? RETIREMENT_CHART_YEARS);
  const retirementSeries: number[] = [start];
  let retBalance = start;
  for (let year = 1; year <= chartLimit; year++) {
    retBalance = retBalance * (1 + retirementReturn) - annualSpend;
    if (retBalance <= 0) {
      retirementSeries.push(0);
      break;
    }
    retirementSeries.push(retBalance);
  }

  return {
    fireNumber: target,
    reached: true,
    accumulationYears,
    accumulationSeries,
    retirementReturn,
    retirementSeries,
    trend,
    depletionYear,
  };
}
