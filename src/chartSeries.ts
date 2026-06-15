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

export interface ChartSeries {
  /** Balance at the end of each accumulation year (offset 0..accYears). */
  accumulation: SeriesPoint[];
  /** Balance during retirement (offset accYears..accYears+retLen). Empty if it doesn't reach. */
  retirement: SeriesPoint[];
  /** Years of contributions until retirement. */
  accYears: number;
  /** Projected retirement years (length of the retirement series minus the initial point). */
  retLen: number;
  /** Total years on the X axis (accumulation + retirement). */
  totalYears: number;
}

export function buildChartSeries(result: LifecycleResult): ChartSeries {
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

  return { accumulation, retirement, accYears, retLen, totalYears };
}
