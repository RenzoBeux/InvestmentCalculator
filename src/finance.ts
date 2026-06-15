/**
 * Financial logic of the retirement planner.
 *
 * The model works in REAL terms (today's purchasing power): spending stays
 * constant and the returns already come with inflation discounted out.
 * It's the only honest way to project several decades.
 *
 * The assumptions are no longer hardcoded: they live in `Assumptions` and the
 * user can edit them from the UI ("Ajustes avanzados" panel). Whoever wants to
 * touch the model itself —not just the numbers— does it in `computeLifecycle`.
 *
 * This file is pure and typed: it doesn't touch the DOM or React.
 */

/** The three portfolios with a predefined return (editable in settings). */
export type PresetAllocation = "aggressive" | "balanced" | "conservative";

/** Portfolio chosen for retirement: one of the presets or a custom one. */
export type Allocation = PresetAllocation | "custom";

/** How the user enters the returns. */
export type ReturnMode = "real" | "nominal";

export const ALLOCATION_LABELS: Record<Allocation, string> = {
  aggressive: "100% acciones",
  balanced: "60 / 40",
  conservative: "40 / 60",
  custom: "Personalizada",
};

/** Only the preset portfolios; "custom" is handled separately. */
export const ALLOCATIONS: PresetAllocation[] = ["aggressive", "balanced", "conservative"];

/**
 * Retirement profile: a shortcut that sets the withdrawal rate and the portfolio
 * in one go, ordered from most to least risk. It's a presentation layer over
 * those two fields —it isn't stored separately—: the active profile is derived
 * from the current values with `deriveProfile`. "custom" (Personalizado) means
 * "doesn't match any preset, the user picks it by hand".
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

/** The values that each preset profile applies. */
export interface ProfilePreset {
  withdrawalRate: number;
  allocation: PresetAllocation;
}

/**
 * Profile → (withdrawal rate, portfolio) map. "moderate" matches the default
 * values (4% + 60/40), so the default plan starts on "Moderado".
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

/** Button order, from most to least risk; "custom" goes last. */
export const RETIREMENT_PROFILE_ORDER: RetirementProfile[] = [
  "aggressive",
  "moderate",
  "conservative",
  "veryConservative",
  "custom",
];

/**
 * Derives the active profile from the current values. If the rate was entered
 * by hand, the portfolio is "custom", or the combination doesn't match any
 * preset, the profile is "custom".
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
 * Which unknown the calculator solves for.
 * - "timeline": the classic mode. You fix the contribution (and everything else)
 *   and we tell you at what age / in how many years you reach your number.
 * - "monthly": you fix the target retirement age and we solve for the monthly
 *   contribution needed to land exactly at that age.
 * - "initial": you fix the age and the contribution and we solve for how much
 *   initial investment you need to start with today.
 */
export type SolveFor = "timeline" | "monthly" | "initial";

/**
 * Model assumptions. All configurable from the UI.
 *
 * If `returnMode` is "nominal", the returns below are interpreted as nominal
 * and converted to real by discounting out `inflation`. If it's "real", they're
 * used as-is (inflation is ignored).
 */
export interface Assumptions {
  returnMode: ReturnMode;
  /** Assumed annual inflation (only used in "nominal" mode). */
  inflation: number;
  /** Annual return while accumulating (editable assumption, not tied to any instrument). */
  accumulationReturn: number;
  /** Annual return during retirement, according to the chosen preset portfolio. */
  retirementReturns: Record<PresetAllocation, number>;
  /** Maximum accumulation horizon to simulate (years). */
  maxAccumulationYears: number;
  /** Years of retirement to project on the chart. */
  retirementChartYears: number;
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  returnMode: "real",
  inflation: 0.03,
  accumulationReturn: 0.06,
  retirementReturns: {
    aggressive: 0.06, // 100% stocks
    balanced: 0.045, // 60 / 40
    conservative: 0.035, // 40 / 60
  },
  maxAccumulationYears: 60,
  retirementChartYears: 45,
};

// Compatibility: historical names that point to the default values.
export const ACCUMULATION_REAL_RETURN = DEFAULT_ASSUMPTIONS.accumulationReturn;
export const RETIREMENT_REAL_RETURNS = DEFAULT_ASSUMPTIONS.retirementReturns;

export interface PlanInputs {
  /** Initial investment, in today's dollars. */
  initial: number;
  /** Monthly contribution, in today's dollars. */
  monthly: number;
  /**
   * Annual real growth of the contribution (e.g. 0.03 = +3% per year above
   * inflation). 0 = contribution constant in today's purchasing power, which is
   * how the model behaved before this field existed. It's always real,
   * regardless of `returnMode`, so as not to break that default behavior.
   */
  monthlyGrowth: number;
  /** Desired monthly spending in retirement, in today's dollars. */
  monthlySpend: number;
  /** Safe withdrawal rate (e.g. 0.04 = 4%). */
  withdrawalRate: number;
  /** Portfolio allocation during retirement. */
  retirementAllocation: Allocation;
  /**
   * Portfolio return when `retirementAllocation` is "custom".
   * It's interpreted according to `returnMode` (real or nominal), like the rest.
   */
  customRetirementReturn: number;
  /**
   * Target retirement age. Used by the Coast FIRE calculation and, in the
   * auto-calc modes (`solveFor` != "timeline"), it's the goal against which the
   * monthly contribution or the initial investment is solved.
   */
  coastTargetAge: number;
  /**
   * Which value the app auto-calculates. Defaults to "timeline" (classic mode,
   * no solving), so old plans behave the same as before.
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
 * Default starting age. 0 is NOT a neutral default: the UI treats `currentAge`
 * at 0 as "no age loaded", so the real default value is 30.
 */
export const DEFAULT_AGE = 30;

export interface LifecycleResult {
  /** Target portfolio = annual spending / withdrawal rate. */
  fireNumber: number;
  /** Is the target reached within the accumulation horizon? */
  reached: boolean;
  /** Years of contributions until the retirement number is reached. */
  accumulationYears: number;
  /** Balance at the end of each accumulation year (index 0..accumulationYears). */
  accumulationSeries: number[];
  /** Real return applied during accumulation. */
  accumulationReturn: number;
  /** Real return applied during retirement. */
  retirementReturn: number;
  /** Balance at the start of retirement and at the end of each year (index 0..n). */
  retirementSeries: number[];
  /** Whether the portfolio grows, stays flat, or depletes during retirement. */
  trend: Trend;
  /** Years into retirement until depletion (only if the trend is "decline"). */
  depletionYear: number | null;
  /**
   * Own money contributed when the number is reached (or at the end of the
   * horizon if not reached): initial + sum of all monthly contributions.
   */
  contributedAtFire: number;
  /** What the return generated: balance − contributions. The "compound interest". */
  growthAtFire: number;
}

/**
 * Converts a return to its real equivalent according to the chosen mode.
 * In nominal mode: r_real = (1 + r_nom) / (1 + inflation) − 1 (Fisher equation).
 */
export function effectiveRealReturn(annualReturn: number, assumptions: Assumptions): number {
  if (assumptions.returnMode === "real") return annualReturn;
  return (1 + annualReturn) / (1 + Math.max(0, assumptions.inflation)) - 1;
}

/** Retirement number: how much capital you need to live off the portfolio. */
export function fireNumber(monthlySpend: number, withdrawalRate: number): number {
  if (withdrawalRate <= 0) return Infinity;
  return (Math.max(0, monthlySpend) * 12) / withdrawalRate;
}

/**
 * Coast FIRE number: the capital that, WITHOUT contributing more, compounds up
 * to the retirement number `fireTarget` in `yearsToTarget` years at the given
 * return. If you're already at the target age (or past it), you need the full number.
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

// ------------------------------------------------------------- Auto-calc ---
// The solve (modes "monthly" / "initial") is the INVERSE of accumulation. The
// key: the balance after N years is AFFINE in the value being solved for
//   balance(N) = initial · initialGrowth + contribution · contributionFactor
// so it's enough to evaluate the recurrence at two points to recover the line
// and solve exactly, no searching. So that the result is consistent with
// `computeLifecycle`, we replicate its month-by-month recurrence to the letter.

/**
 * Runs the same accumulation recurrence as `computeLifecycle`, for exactly
 * `years` years (without cutting off when the target is reached), and returns
 * the final balance. Pure: it doesn't touch state or React.
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
  /** The solved value (monthly contribution or initial investment), always >= 0. */
  value: number;
  /** Why the result is what it is, so the UI shows the right message. */
  status: SolveStatus;
  /** The retirement number used, to display it without recalculating. */
  target: number;
}

// We nudge the solved value a hair upward (relative to the target) to cross the
// simulation's strict `balance >= number` check: without this, the floating-point
// residue leaves the balance a hundredth below and the model "retires" in year
// N+1 instead of N.
const SOLVE_NUDGE = 1e-6;

/**
 * Monthly contribution needed to reach the retirement number EXACTLY in `years`
 * years, with everything else fixed. Ignores `inputs.monthly` (that's what it
 * solves for). Uses the same effective real return as the simulation.
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
  // Balance with the initial only (contribution 0) and a unit contribution (line factor).
  const seed = accumulateBalance(Math.max(0, inputs.initial), 0, years, monthlyRate, g);
  if (seed >= target) return { value: 0, status: "alreadyThere", target };
  const factor = accumulateBalance(0, 1, years, monthlyRate, g);
  if (factor <= 0) return { value: 0, status: "unreachable", target };

  const required = (target - seed + target * SOLVE_NUDGE) / factor;
  return { value: required, status: "ok", target };
}

/**
 * Initial investment needed to reach the retirement number in `years` years,
 * with the monthly contribution and everything else fixed. Ignores `inputs.initial`.
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
  // Initial factor = (1 + r/12)^(12·years); we get it from the same recurrence.
  const lumpFactor = accumulateBalance(1, 0, years, monthlyRate, g);
  if (lumpFactor <= 0) return { value: 0, status: "unreachable", target };

  const required = (target - fromMonthly + target * SOLVE_NUDGE) / lumpFactor;
  return { value: required, status: "ok", target };
}

/**
 * Resolves the active solve (according to `inputs.solveFor`) for display in the
 * UI. Returns null in "timeline" mode or if there's no age loaded (no age means
 * no horizon: the solve is by retirement age).
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
 * Injects the solved value into the inputs before simulating, so the chart, the
 * stats, the verdict, and the PDF all tell the same story. NEVER mutates state:
 * the contribution/initial the user typed stays intact in `inputs` and is
 * restored when switching back to "timeline". In "timeline", with no age, or if
 * the target is unreachable, it returns the inputs/assumptions as-is.
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
  // If the target age falls beyond the default horizon, we extend it so the
  // forward simulation reaches far enough to draw up to that age.
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
 * Simulates the full cycle: accumulation (monthly compounding) up to the
 * retirement number, then retirement (annual withdrawals) with the chosen portfolio.
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
  // The "custom" portfolio uses the return the user entered by hand; the others
  // take it from the assumptions according to the chosen mix.
  const retirementRaw =
    inputs.retirementAllocation === "custom"
      ? inputs.customRetirementReturn
      : assumptions.retirementReturns[inputs.retirementAllocation];
  const retirementReturn = effectiveRealReturn(retirementRaw, assumptions);
  const maxYears = Math.max(1, Math.round(assumptions.maxAccumulationYears));
  const chartYears = Math.max(1, Math.round(assumptions.retirementChartYears));

  // --- Accumulation phase ---
  // The contribution starts at `monthly` and grows by `monthlyGrowth` (real) at
  // the end of each year. We track how much you put in (`contributed`) to
  // separate your own capital from compound interest.
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
        // The contribution rises for the following year.
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

  // --- Retirement phase ---
  // The balance evolves as bal_{n+1} = bal_n * (1 + r) - spending.
  // Its break-even point is spending / r: above it grows, below it depletes.
  const start = accumulationSeries[accumulationSeries.length - 1];

  let trend: Trend;
  let depletionYear: number | null = null;

  if (annualSpend <= 0) {
    // With no withdrawals (spending 0) the portfolio never depletes.
    trend = retirementReturn > 0 ? "grow" : "flat";
  } else if (retirementReturn > 0) {
    // With a positive return there's a break-even point (spending / r): above
    // it the portfolio grows on its own, below it gradually depletes.
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
    // Real return <= 0: the portfolio generates nothing to cover the spending,
    // so it always depletes. The closed-form formula still holds with the real
    // (negative) break-even point; at r = 0 the depletion is linear.
    trend = "decline";
    if (retirementReturn === 0) {
      depletionYear = Math.ceil(start / annualSpend);
    } else if (retirementReturn > -1) {
      const fixedPoint = annualSpend / retirementReturn; // negative
      depletionYear = Math.ceil(
        Math.log(fixedPoint / (fixedPoint - start)) / Math.log(1 + retirementReturn)
      );
    } else {
      // 1 + r <= 0 (return <= -100%): degenerate, unreachable from the UI.
      depletionYear = Math.ceil(start / annualSpend);
    }
  }

  // Safety net: no path should leave a non-finite depletion year (prevents a
  // NaN/Infinity from leaking into the chart or the verdict text).
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
