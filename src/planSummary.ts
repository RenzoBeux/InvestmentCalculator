/**
 * Plan-derived narrative: the retirement age, the retirement summary, and the
 * "verdict" (the ok/bad/warn status text). This is the single source of that
 * logic: the screen and the PDF consume it identically, so they never drift.
 *
 * Pure and DOM-free: it receives the formatters as parameters. The text differs
 * on purpose between the screen and the PDF in three spots, controlled by `surface`.
 */
import {
  ALLOCATION_LABELS,
  type Assumptions,
  type LifecycleResult,
  type PlanInputs,
} from "./finance";

export type StatusKind = "ok" | "bad" | "warn";

export type Surface = "screen" | "pdf";

export interface PlanSummaryFmt {
  /** Formats an already-rounded amount (e.g. "US$1.234"). */
  money: (n: number) => string;
  /** Formats a percentage (0.04 → "4%"). */
  pct: (x: number) => string;
}

export interface PlanSummary {
  /** If an age is loaded we show the real age instead of "years from now". */
  ageMode: boolean;
  /** Age at which you retire (valid only in ageMode). */
  retirementAge: number;
  /** Age at which the portfolio runs out, if applicable. */
  depletionAge: number | null;
  /** "Te jubilás..." phrase. */
  jubilasPhrase: string;
  /** What happens to the money in retirement (for the stats card). */
  retirementSummary: string;
  /** Status banner class. */
  kind: StatusKind;
  /** Full status text. */
  verdict: string;
}

export function buildPlanSummary(
  result: LifecycleResult,
  inputs: PlanInputs,
  assumptions: Assumptions,
  currentAge: number,
  fmt: PlanSummaryFmt,
  surface: Surface = "screen"
): PlanSummary {
  const { money, pct } = fmt;
  const ageMode = currentAge > 0;
  const retirementAge = currentAge + result.accumulationYears;
  const depletionAge =
    result.depletionYear != null ? retirementAge + result.depletionYear : null;

  const jubilasPhrase = ageMode
    ? `Te jubilás a los ${retirementAge} años`
    : `Te jubilás al año ${result.accumulationYears}`;

  const retirementSummary = !result.reached
    ? surface === "pdf"
      ? "No llegás"
      : "—"
    : result.trend === "decline"
    ? ageMode
      ? `Se agota a los ~${depletionAge} años`
      : `Se agota ~año ${result.depletionYear}`
    : "Dura indefinidamente";

  const alloc = ALLOCATION_LABELS[inputs.retirementAllocation];

  let kind: StatusKind;
  let verdict: string;
  if (!result.reached) {
    kind = "warn";
    verdict = `Con ${money(inputs.monthly)}/mes no alcanzás tu número (${money(
      result.fireNumber
    )}) en ${assumptions.maxAccumulationYears} años. Subí el aporte o bajá el gasto.`;
  } else if (result.trend === "decline") {
    kind = "bad";
    const dep = ageMode
      ? `alrededor de los ${depletionAge} años`
      : surface === "pdf"
      ? `~año ${result.depletionYear}`
      : `alrededor del año ${result.depletionYear} del retiro`;
    const middle =
      surface === "pdf"
        ? "tu cartera rinde menos de lo que retirás y se agota"
        : "tu cartera rinde menos de lo que retirás: empieza a achicarse y se agota";
    const tail =
      surface === "pdf"
        ? "Bajá la tasa de retiro o juntá más capital."
        : "Necesitás una tasa de retiro más baja, o más capital.";
    verdict = `${jubilasPhrase}, pero con ${alloc} (~${pct(
      result.retirementReturn
    )} real) ${middle} ${dep}. ${tail}`;
  } else {
    kind = "ok";
    const growSuffix =
      result.trend === "grow"
        ? surface === "pdf"
          ? " — incluso sigue creciendo"
          : " — de hecho, sigue creciendo"
        : "";
    verdict = `${jubilasPhrase} y tu cartera (${alloc}) aguanta el retiro${growSuffix}. Tu ${pct(
      inputs.withdrawalRate
    )} es sostenible con este rendimiento.`;
  }

  return {
    ageMode,
    retirementAge,
    depletionAge,
    jubilasPhrase,
    retirementSummary,
    kind,
    verdict,
  };
}
