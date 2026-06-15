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

/**
 * Perfil de retiro: un atajo que fija de una vez la tasa de retiro y la cartera,
 * ordenado de más a menos riesgo. Es una capa de presentación sobre esos dos
 * campos —no se guarda aparte—: el perfil activo se deriva de los valores
 * actuales con `deriveProfile`. "custom" (Personalizado) es "no coincide con
 * ningún preset, lo elige el usuario a mano".
 */
export type RetirementProfile =
  | "aggressive"
  | "moderate"
  | "conservative"
  | "veryConservative"
  | "custom";

export const RETIREMENT_PROFILE_LABELS: Record<RetirementProfile, string> = {
  aggressive: "Arriesgado",
  moderate: "Moderado",
  conservative: "Conservador",
  veryConservative: "Muy conservador",
  custom: "Personalizado",
};

/** Los valores que aplica cada perfil predefinido. */
export interface ProfilePreset {
  withdrawalRate: number;
  allocation: PresetAllocation;
}

/**
 * Mapa perfil → (tasa de retiro, cartera). "moderate" coincide con los valores
 * por defecto (4% + 60/40), así que el plan por defecto arranca en "Moderado".
 */
export const RETIREMENT_PROFILES: Record<
  Exclude<RetirementProfile, "custom">,
  ProfilePreset
> = {
  aggressive: { withdrawalRate: 0.04, allocation: "aggressive" },
  moderate: { withdrawalRate: 0.04, allocation: "balanced" },
  conservative: { withdrawalRate: 0.035, allocation: "conservative" },
  veryConservative: { withdrawalRate: 0.03, allocation: "conservative" },
};

/** Orden de los botones, de más a menos riesgo; "custom" va al final. */
export const RETIREMENT_PROFILE_ORDER: RetirementProfile[] = [
  "aggressive",
  "moderate",
  "conservative",
  "veryConservative",
  "custom",
];

/**
 * Deriva el perfil activo a partir de los valores actuales. Si la tasa se cargó
 * a mano, la cartera es "custom", o la combinación no coincide con ningún preset,
 * el perfil es "custom".
 */
export function deriveProfile(
  withdrawalRate: number,
  allocation: Allocation,
  withdrawalIsCustom: boolean
): RetirementProfile {
  if (withdrawalIsCustom || allocation === "custom") return "custom";
  for (const key of RETIREMENT_PROFILE_ORDER) {
    if (key === "custom") continue;
    const preset = RETIREMENT_PROFILES[key];
    if (
      preset.allocation === allocation &&
      Math.abs(preset.withdrawalRate - withdrawalRate) < 1e-9
    ) {
      return key;
    }
  }
  return "custom";
}

export type Trend = "grow" | "flat" | "decline";

/**
 * Qué incógnita resuelve la calculadora.
 * - "timeline": el modo clásico. Fijás el aporte (y todo lo demás) y te decimos
 *   a qué edad / en cuántos años llegás a tu número.
 * - "monthly": fijás la edad de jubilación objetivo y despejamos el aporte
 *   mensual necesario para llegar justo a esa edad.
 * - "initial": fijás la edad y el aporte y despejamos con cuánta inversión
 *   inicial necesitás arrancar hoy.
 */
export type SolveFor = "timeline" | "monthly" | "initial";

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
  /**
   * Edad objetivo de jubilación. La usa el cálculo de Coast FIRE y, en los modos
   * de auto-cálculo (`solveFor` != "timeline"), es la meta sobre la que se
   * despeja el aporte mensual o la inversión inicial.
   */
  coastTargetAge: number;
  /**
   * Qué valor auto-calcula la app. Por defecto "timeline" (modo clásico, sin
   * despeje), así los planes viejos se comportan igual que antes.
   */
  solveFor: SolveFor;
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
  solveFor: "timeline",
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

// ----------------------------------------------------------- Auto-cálculo ---
// El despeje (modos "monthly" / "initial") es el INVERSO de la acumulación. La
// clave: el saldo al cabo de N años es AFÍN en el valor a despejar
//   saldo(N) = inicial · crecimientoDelInicial + aporte · factorDelAporte
// así que alcanza con evaluar la recurrencia en dos puntos para recuperar la
// recta y despejar exacto, sin tanteo. Para que el resultado sea consistente
// con `computeLifecycle`, replicamos su recurrencia mes a mes al pie de la letra.

/**
 * Corre la misma recurrencia de acumulación que `computeLifecycle`, durante
 * exactamente `years` años (sin cortar al alcanzar el objetivo), y devuelve el
 * saldo final. Puro: no toca estado ni React.
 */
function accumulateBalance(
  initial: number,
  monthly: number,
  years: number,
  monthlyRate: number,
  monthlyGrowth: number
): number {
  let balance = initial;
  let currentMonthly = monthly;
  const months = years * 12;
  for (let month = 1; month <= months; month++) {
    balance = balance * (1 + monthlyRate) + currentMonthly;
    if (month % 12 === 0) currentMonthly *= 1 + monthlyGrowth;
  }
  return balance;
}

export type SolveStatus = "ok" | "alreadyThere" | "noHorizon" | "unreachable";

export interface SolveResult {
  /** El valor despejado (aporte mensual o inversión inicial), siempre >= 0. */
  value: number;
  /** Por qué el resultado es lo que es, para que la UI muestre el mensaje justo. */
  status: SolveStatus;
  /** El número de retiro usado, para mostrarlo sin recalcular. */
  target: number;
}

// Empujamos el valor despejado un pelo hacia arriba (relativo al objetivo) para
// cruzar el chequeo estricto `saldo >= número` de la simulación: sin esto, el
// residuo de punto flotante deja el saldo un centésimo por debajo y el modelo
// "se jubila" en el año N+1 en vez del N.
const SOLVE_NUDGE = 1e-6;

/**
 * Aporte mensual necesario para alcanzar el número de retiro EXACTAMENTE en
 * `years` años, con todo lo demás fijo. Ignora `inputs.monthly` (es lo que
 * despeja). Usa el mismo rendimiento real efectivo que la simulación.
 */
export function solveMonthlyForYears(
  inputs: PlanInputs,
  assumptions: Assumptions,
  years: number
): SolveResult {
  const target = fireNumber(inputs.monthlySpend, inputs.withdrawalRate);
  if (!isFinite(target)) return { value: 0, status: "unreachable", target };
  if (years <= 0) return { value: 0, status: "noHorizon", target };

  const monthlyRate =
    effectiveRealReturn(assumptions.accumulationReturn, assumptions) / 12;
  const g = inputs.monthlyGrowth;
  // Saldo solo con el inicial (aporte 0) y aporte unitario (factor de la recta).
  const seed = accumulateBalance(Math.max(0, inputs.initial), 0, years, monthlyRate, g);
  if (seed >= target) return { value: 0, status: "alreadyThere", target };
  const factor = accumulateBalance(0, 1, years, monthlyRate, g);
  if (factor <= 0) return { value: 0, status: "unreachable", target };

  const required = (target - seed + target * SOLVE_NUDGE) / factor;
  return { value: required, status: "ok", target };
}

/**
 * Inversión inicial necesaria para alcanzar el número de retiro en `years` años,
 * con el aporte mensual y todo lo demás fijo. Ignora `inputs.initial`.
 */
export function solveInitialForYears(
  inputs: PlanInputs,
  assumptions: Assumptions,
  years: number
): SolveResult {
  const target = fireNumber(inputs.monthlySpend, inputs.withdrawalRate);
  if (!isFinite(target)) return { value: 0, status: "unreachable", target };
  if (years <= 0) return { value: 0, status: "noHorizon", target };

  const monthlyRate =
    effectiveRealReturn(assumptions.accumulationReturn, assumptions) / 12;
  const g = inputs.monthlyGrowth;
  const fromMonthly = accumulateBalance(0, Math.max(0, inputs.monthly), years, monthlyRate, g);
  if (fromMonthly >= target) return { value: 0, status: "alreadyThere", target };
  // Factor del inicial = (1 + r/12)^(12·años); lo sacamos de la misma recurrencia.
  const lumpFactor = accumulateBalance(1, 0, years, monthlyRate, g);
  if (lumpFactor <= 0) return { value: 0, status: "unreachable", target };

  const required = (target - fromMonthly + target * SOLVE_NUDGE) / lumpFactor;
  return { value: required, status: "ok", target };
}

/**
 * Resuelve el despeje activo (según `inputs.solveFor`) para mostrarlo en la UI.
 * Devuelve null en modo "timeline" o si no hay edad cargada (sin edad no hay
 * horizonte: el despeje es por edad de jubilación).
 */
export function resolveSolve(
  inputs: PlanInputs,
  assumptions: Assumptions,
  currentAge: number
): SolveResult | null {
  if (inputs.solveFor === "timeline" || currentAge <= 0) return null;
  const years = inputs.coastTargetAge - currentAge;
  return inputs.solveFor === "monthly"
    ? solveMonthlyForYears(inputs, assumptions, years)
    : solveInitialForYears(inputs, assumptions, years);
}

/**
 * Inyecta el valor despejado en los inputs antes de simular, para que el
 * gráfico, los stats, el veredicto y el PDF cuenten todos la misma historia.
 * NUNCA muta el estado: el aporte/inicial que tipeó el usuario queda intacto en
 * `inputs` y se restaura al volver a "timeline". En "timeline", sin edad, o si
 * el objetivo es inalcanzable, devuelve los inputs/supuestos tal cual.
 */
export function applySolve(
  inputs: PlanInputs,
  assumptions: Assumptions,
  currentAge: number
): { inputs: PlanInputs; assumptions: Assumptions } {
  const solve = resolveSolve(inputs, assumptions, currentAge);
  if (!solve || (solve.status !== "ok" && solve.status !== "alreadyThere")) {
    return { inputs, assumptions };
  }
  const years = inputs.coastTargetAge - currentAge;
  // Si la edad objetivo cae más allá del horizonte por defecto, lo ampliamos
  // para que la simulación hacia adelante alcance a dibujar hasta esa edad.
  const reachAssumptions =
    years > assumptions.maxAccumulationYears
      ? { ...assumptions, maxAccumulationYears: years }
      : assumptions;
  const solvedInputs =
    inputs.solveFor === "monthly"
      ? { ...inputs, monthly: solve.value }
      : { ...inputs, initial: solve.value };
  return { inputs: solvedInputs, assumptions: reachAssumptions };
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

  let trend: Trend;
  let depletionYear: number | null = null;

  if (annualSpend <= 0) {
    // Sin retiros (gasto 0) la cartera no se agota nunca.
    trend = retirementReturn > 0 ? "grow" : "flat";
  } else if (retirementReturn > 0) {
    // Con rendimiento positivo hay un punto de equilibrio (gasto / r): por
    // encima la cartera crece sola, por debajo se va agotando.
    const fixedPoint = annualSpend / retirementReturn;
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
  } else {
    // Rendimiento real <= 0: la cartera no genera nada para cubrir el gasto, así
    // que siempre se agota. La fórmula cerrada sigue valiendo con el punto de
    // equilibrio real (negativo); en r = 0 el agotamiento es lineal.
    trend = "decline";
    if (retirementReturn === 0) {
      depletionYear = Math.ceil(start / annualSpend);
    } else if (retirementReturn > -1) {
      const fixedPoint = annualSpend / retirementReturn; // negativo
      depletionYear = Math.ceil(
        Math.log(fixedPoint / (fixedPoint - start)) / Math.log(1 + retirementReturn)
      );
    } else {
      // 1 + r <= 0 (rendimiento <= -100%): degenerado, inalcanzable desde la UI.
      depletionYear = Math.ceil(start / annualSpend);
    }
  }

  // Red de seguridad: ningún camino debe dejar un año de agotamiento no finito
  // (evita que un NaN/Infinity se filtre al gráfico o al texto del veredicto).
  if (depletionYear != null && !Number.isFinite(depletionYear)) {
    depletionYear = null;
  }

  const chartLimit =
    depletionYear != null ? Math.min(chartYears, depletionYear) : chartYears;
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
