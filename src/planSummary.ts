/**
 * Narrativa derivada del plan: la edad de jubilación, el resumen del retiro y el
 * "veredicto" (el texto del estado ok/bad/warn). Es la única fuente de esa
 * lógica: la pantalla y el PDF la consumen igual, así no se desincronizan.
 *
 * Puro y sin DOM: recibe los formateadores como parámetros. El texto difiere a
 * propósito entre la pantalla y el PDF en tres lugares, controlado por `surface`.
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
  /** Formatea un importe ya redondeado (p. ej. "US$1.234"). */
  money: (n: number) => string;
  /** Formatea un porcentaje (0.04 → "4%"). */
  pct: (x: number) => string;
}

export interface PlanSummary {
  /** Si hay edad cargada mostramos la edad real en vez de "años desde hoy". */
  ageMode: boolean;
  /** Edad a la que se jubila (válida solo en ageMode). */
  retirementAge: number;
  /** Edad a la que se agota la cartera, si aplica. */
  depletionAge: number | null;
  /** Frase "Te jubilás...". */
  jubilasPhrase: string;
  /** Qué pasa con el dinero en el retiro (para la tarjeta de stats). */
  retirementSummary: string;
  /** Clase del banner de estado. */
  kind: StatusKind;
  /** Texto completo del estado. */
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
