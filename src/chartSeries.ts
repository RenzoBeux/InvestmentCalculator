/**
 * Construye las series del gráfico a partir del resultado del modelo. Puro: no
 * sabe de recharts ni de jsPDF, ni de edades. Cada superficie lo adapta después
 * (la pantalla arma filas con huecos `null`; el PDF mapea a puntos `[x, y]`).
 */
import { type LifecycleResult } from "./finance";

/** Un punto de la serie: el desfasaje en años desde hoy y su valor. */
export interface SeriesPoint {
  /** Años desde hoy (0 = hoy). Sumale la edad actual para obtener la edad. */
  yearOffset: number;
  value: number;
}

export interface ChartSeries {
  /** Saldo al final de cada año de acumulación (offset 0..accYears). */
  accumulation: SeriesPoint[];
  /** Saldo durante el retiro (offset accYears..accYears+retLen). Vacío si no llega. */
  retirement: SeriesPoint[];
  /** Años de aportes hasta jubilarse. */
  accYears: number;
  /** Años de retiro proyectados (largo de la serie de retiro menos el punto inicial). */
  retLen: number;
  /** Total de años en el eje X (acumulación + retiro). */
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
