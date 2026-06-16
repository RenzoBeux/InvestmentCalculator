/**
 * Builds the chart series from the model result. Pure: it knows nothing about
 * recharts, jsPDF, or ages. Each surface adapts it afterward
 * (the screen builds rows with `null` gaps; the PDF maps to `[x, y]` points).
 */
import { type LifecycleResult } from "./finance";

/** A point on the series: the offset in years from today and its value. */
export interface SeriesPoint {
  /** Years from today (0 = today). Add the current age to get the age. */
  yearOffset: number;
  value: number;
}

/**
 * Coast FIRE inputs for the optional "ghost" trajectory: the capital you'd need
 * today (`value`) and how many years until the target retirement age (`years`).
 * When provided, `buildChartSeries` draws the curve that, starting from `value`
 * and WITHOUT further contributions, compounds up to the retirement number.
 */
export interface CoastInput {
  value: number;
  years: number;
}

export interface ChartSeries {
  /** Balance at the end of each accumulation year (offset 0..accYears). */
  accumulation: SeriesPoint[];
  /** Balance during retirement (offset accYears..accYears+retLen). Empty if it doesn't reach. */
  retirement: SeriesPoint[];
  /**
   * Coast FIRE "ghost" curve (offset 0..coast.years), compounding the coast
   * capital at the accumulation return up to the retirement number. Empty when
   * no `coast` is given. Its last point equals `result.fireNumber` by construction.
   */
  coasting: SeriesPoint[];
  /** Years of contributions until retirement. */
  accYears: number;
  /** Projected retirement years (length of the retirement series minus the initial point). */
  retLen: number;
  /** Total years on the X axis (accumulation + retirement). */
  totalYears: number;
}

export function buildChartSeries(
  result: LifecycleResult,
  coast?: CoastInput | null
): ChartSeries {
  const accYears = result.accumulationYears;
  const retLen =
    result.retirementSeries.length > 0 ? result.retirementSeries.length - 1 : 0;
  const totalYears = accYears + retLen;

  const accumulation: SeriesPoint[] = result.accumulationSeries.map(
    (value, k) => ({ yearOffset: k, value })
  );
  const retirement: SeriesPoint[] = result.retirementSeries.map((value, j) => ({
    yearOffset: accYears + j,
    value,
  }));

  // Coast curve: same annual return used to derive the coast number, so the
  // last point lands exactly on `result.fireNumber` (the target line).
  const coasting: SeriesPoint[] = [];
  if (coast && isFinite(coast.value) && coast.years > 0) {
    const factor = 1 + result.accumulationReturn;
    for (let k = 0; k <= coast.years; k++) {
      coasting.push({ yearOffset: k, value: coast.value * Math.pow(factor, k) });
    }
  }

  return { accumulation, retirement, coasting, accYears, retLen, totalYears };
}
