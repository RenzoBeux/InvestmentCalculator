/**
 * Lógica financiera del planificador de retiro.
 *
 * El modelo trabaja en términos REALES (poder de compra de hoy): el gasto se
 * mantiene constante y los rendimientos ya vienen con la inflación descontada.
 * Es la única forma honesta de proyectar varias décadas.
 *
 * Los supuestos ya no están hardcodeados: viven en `Assumptions` y el usuario
 * los puede editar desde la UI (panel "Ajustes avanzados"). Quien quiera tocar
 * el modelo en sí —no solo los números— lo hace en `computeLifecycle`.
 *
 * Este archivo es puro y tipado: no toca el DOM ni React.
 */

/** Las tres carteras con un rendimiento predefinido (editable en ajustes). */
export type PresetAllocation = "aggressive" | "balanced" | "conservative";

/** Cartera elegida en el retiro: una de las predefinidas o una personalizada. */
export type Allocation = PresetAllocation | "custom";

/** Cómo ingresa el usuario los rendimientos. */
export type ReturnMode = "real" | "nominal";

export const ALLOCATION_LABELS: Record<Allocation, string> = {
  aggressive: "100% acciones",
  balanced: "60 / 40",
  conservative: "40 / 60",
  custom: "Personalizada",
};

/** Solo las carteras predefinidas; "custom" se maneja aparte. */
export const ALLOCATIONS: PresetAllocation[] = ["aggressive", "balanced", "conservative"];

export type Trend = "grow" | "flat" | "decline";

/**
 * Supuestos del modelo. Todos configurables desde la UI.
 *
 * Si `returnMode` es "nominal", los rendimientos de abajo se interpretan como
 * nominales y se convierten a reales descontando `inflation`. Si es "real", se
 * usan tal cual (la inflación se ignora).
 */
export interface Assumptions {
  returnMode: ReturnMode;
  /** Inflación anual asumida (solo se usa en modo "nominal"). */
  inflation: number;
  /** Rendimiento anual mientras acumulás (supuesto editable, sin atar a un instrumento). */
  accumulationReturn: number;
  /** Rendimiento anual durante el retiro, según la cartera predefinida elegida. */
  retirementReturns: Record<PresetAllocation, number>;
  /** Horizonte máximo de acumulación a simular (años). */
  maxAccumulationYears: number;
  /** Años de retiro a proyectar en el gráfico. */
  retirementChartYears: number;
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  returnMode: "real",
  inflation: 0.03,
  accumulationReturn: 0.06,
  retirementReturns: {
    aggressive: 0.06, // 100% acciones
    balanced: 0.045, // 60 / 40
    conservative: 0.035, // 40 / 60
  },
  maxAccumulationYears: 60,
  retirementChartYears: 45,
};

// Compatibilidad: nombres históricos que apuntan a los valores por defecto.
export const ACCUMULATION_REAL_RETURN = DEFAULT_ASSUMPTIONS.accumulationReturn;
export const RETIREMENT_REAL_RETURNS = DEFAULT_ASSUMPTIONS.retirementReturns;

export interface PlanInputs {
  /** Inversión inicial, en dólares de hoy. */
  initial: number;
  /** Aporte mensual, en dólares de hoy. */
  monthly: number;
  /**
   * Crecimiento real anual del aporte (p. ej. 0.03 = +3% por año por encima de
   * la inflación). 0 = aporte constante en poder de compra de hoy, que es como
   * se comportaba el modelo antes de existir este campo. Siempre es real, sin
   * importar `returnMode`, para no romper ese comportamiento por defecto.
   */
  monthlyGrowth: number;
  /** Gasto mensual deseado en el retiro, en dólares de hoy. */
  monthlySpend: number;
  /** Tasa de retiro segura (p. ej. 0.04 = 4%). */
  withdrawalRate: number;
  /** Asignación de la cartera durante el retiro. */
  retirementAllocation: Allocation;
  /**
   * Rendimiento de la cartera cuando `retirementAllocation` es "custom".
   * Se interpreta según `returnMode` (real o nominal), igual que los demás.
   */
  customRetirementReturn: number;
  /** Edad objetivo de jubilación, usada solo para el cálculo de Coast FIRE. */
  coastTargetAge: number;
}

export const DEFAULT_INPUTS: PlanInputs = {
  initial: 0,
  monthly: 500,
  monthlyGrowth: 0,
  monthlySpend: 1000,
  withdrawalRate: 0.04,
  retirementAllocation: "balanced",
  customRetirementReturn: 0.05,
  coastTargetAge: 65,
};

/**
 * Edad inicial por defecto. 0 NO es un default neutro: la UI trata `currentAge`
 * en 0 como "sin edad cargada", así que el valor por defecto real es 30.
 */
export const DEFAULT_AGE = 30;

export interface LifecycleResult {
  /** Cartera objetivo = gasto anual / tasa de retiro. */
  fireNumber: number;
  /** ¿Se alcanza el objetivo dentro del horizonte de acumulación? */
  reached: boolean;
  /** Años de aportes hasta alcanzar el número de retiro. */
  accumulationYears: number;
  /** Saldo al final de cada año de acumulación (índice 0..accumulationYears). */
  accumulationSeries: number[];
  /** Rendimiento real aplicado en la acumulación. */
  accumulationReturn: number;
  /** Rendimiento real aplicado en el retiro. */
  retirementReturn: number;
  /** Saldo al inicio del retiro y al final de cada año (índice 0..n). */
  retirementSeries: number[];
  /** Si la cartera crece, se mantiene o se agota durante el retiro. */
  trend: Trend;
  /** Años dentro del retiro hasta agotarse (solo si la tendencia es "decline"). */
  depletionYear: number | null;
  /**
   * Dinero propio aportado al alcanzar el número (o al final del horizonte si no
   * se alcanza): inicial + suma de todos los aportes mensuales.
   */
  contributedAtFire: number;
  /** Lo que generó el rendimiento: saldo − aportes. El "interés compuesto". */
  growthAtFire: number;
}

/**
 * Convierte un rendimiento al equivalente real según el modo elegido.
 * En modo nominal: r_real = (1 + r_nom) / (1 + inflación) − 1 (ecuación de Fisher).
 */
export function effectiveRealReturn(annualReturn: number, assumptions: Assumptions): number {
  if (assumptions.returnMode === "real") return annualReturn;
  return (1 + annualReturn) / (1 + Math.max(0, assumptions.inflation)) - 1;
}

/** Número de retiro: cuánto capital necesitás para vivir de la cartera. */
export function fireNumber(monthlySpend: number, withdrawalRate: number): number {
  if (withdrawalRate <= 0) return Infinity;
  return (Math.max(0, monthlySpend) * 12) / withdrawalRate;
}

/**
 * Número de Coast FIRE: el capital que, SIN aportar más, capitaliza hasta el
 * número de retiro `fireTarget` en `yearsToTarget` años al rendimiento dado.
 * Si ya estás en la edad objetivo (o pasaste), necesitás el número completo.
 */
export function coastNumber(
  fireTarget: number,
  annualReturn: number,
  yearsToTarget: number
): number {
  if (!isFinite(fireTarget)) return Infinity;
  if (yearsToTarget <= 0) return fireTarget;
  return fireTarget / Math.pow(1 + annualReturn, yearsToTarget);
}

/**
 * Simula el ciclo completo: acumulación (capitalización mensual) hasta el número
 * de retiro, y luego el retiro (retiros anuales) con la cartera elegida.
 */
export function computeLifecycle(
  inputs: PlanInputs,
  assumptions: Assumptions = DEFAULT_ASSUMPTIONS
): LifecycleResult {
  const initial = Math.max(0, inputs.initial);
  const monthly = Math.max(0, inputs.monthly);
  const annualSpend = Math.max(0, inputs.monthlySpend) * 12;
  const target = fireNumber(inputs.monthlySpend, inputs.withdrawalRate);

  const accumulationReturn = effectiveRealReturn(assumptions.accumulationReturn, assumptions);
  // La cartera "custom" usa el rendimiento que el usuario cargó a mano; las
  // demás lo toman de los supuestos según la mezcla elegida.
  const retirementRaw =
    inputs.retirementAllocation === "custom"
      ? inputs.customRetirementReturn
      : assumptions.retirementReturns[inputs.retirementAllocation];
  const retirementReturn = effectiveRealReturn(retirementRaw, assumptions);
  const maxYears = Math.max(1, Math.round(assumptions.maxAccumulationYears));
  const chartYears = Math.max(1, Math.round(assumptions.retirementChartYears));

  // --- Fase de acumulación ---
  // El aporte arranca en `monthly` y crece `monthlyGrowth` (real) a fin de cada
  // año. Llevamos la cuenta de cuánto pusiste vos (`contributed`) para separar el
  // capital propio del interés compuesto.
  const monthlyRate = accumulationReturn / 12;
  const monthlyGrowth = inputs.monthlyGrowth;
  const accumulationSeries: number[] = [initial];
  let balance = initial;
  let contributed = initial;
  let currentMonthly = monthly;
  let accumulationYears = 0;
  let reached = balance >= target;

  if (!reached) {
    for (let month = 1; month <= maxYears * 12; month++) {
      balance = balance * (1 + monthlyRate) + currentMonthly;
      contributed += currentMonthly;
      if (month % 12 === 0) {
        accumulationSeries.push(balance);
        if (balance >= target) {
          accumulationYears = month / 12;
          reached = true;
          break;
        }
        // El aporte sube para el año siguiente.
        currentMonthly *= 1 + monthlyGrowth;
      }
    }
  }

  if (!reached) {
    return {
      fireNumber: target,
      reached: false,
      accumulationYears: accumulationSeries.length - 1,
      accumulationSeries,
      accumulationReturn,
      retirementReturn,
      retirementSeries: [],
      trend: "decline",
      depletionYear: null,
      contributedAtFire: contributed,
      growthAtFire: balance - contributed,
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

  const chartLimit = Math.min(chartYears, depletionYear ?? chartYears);
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
    accumulationReturn,
    retirementReturn,
    retirementSeries,
    trend,
    depletionYear,
    contributedAtFire: contributed,
    growthAtFire: start - contributed,
  };
}
