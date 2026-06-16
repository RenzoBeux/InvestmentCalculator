import { useEffect, useMemo, useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
  ResponsiveContainer,
} from "recharts";
import {
  computeLifecycle,
  coastNumber,
  resolveSolve,
  applySolve,
  deriveProfile,
  ALLOCATION_LABELS,
  ALLOCATIONS,
  RETIREMENT_PROFILES,
  RETIREMENT_PROFILE_LABELS,
  RETIREMENT_PROFILE_ORDER,
  DEFAULT_AGE,
  DEFAULT_ASSUMPTIONS,
  DEFAULT_INPUTS,
  type Allocation,
  type Assumptions,
  type PlanInputs,
  type RetirementProfile,
  type SolveFor,
} from "./finance";
import {
  DEFAULT_CURRENCY,
  currencyByCode,
  makeAxisFormatter,
  makeCurrencyFormatter,
  formatPct,
} from "./format";
import { usePersistedState } from "./usePersistedState";
import { useTheme } from "./useTheme";
import { CHART as COLORS } from "./palette";
import { buildChartSeries } from "./chartSeries";
import { buildPlanSummary } from "./planSummary";
import { AdvancedSettings } from "./components/AdvancedSettings";
import { PercentInput } from "./components/PercentInput";
import { MoneyInput } from "./components/MoneyInput";
import { InfoTip } from "./components/InfoTip";
import { DataActions } from "./components/DataActions";
import { SegmentedControl } from "./components/SegmentedControl";
import { SegmentedWithCustom } from "./components/SegmentedWithCustom";
import { SolvedField } from "./components/SolvedField";
import { StatusBanner } from "./components/StatusBanner";
import { type PlanData } from "./exportData";
import { readPlanFromHash } from "./shareUrl";

const WITHDRAWAL_OPTIONS = [0.03, 0.035, 0.04];

/** Modes for the "¿Qué querés calcular?" selector (auto-calc). */
const SOLVE_OPTIONS: { value: SolveFor; label: string }[] = [
  { value: "timeline", label: "Cuándo me jubilo" },
  { value: "monthly", label: "Cuánto aportar" },
  { value: "initial", label: "Inversión inicial" },
];

/** The caption explaining, for each mode, what stays fixed and what gets calculated. */
const SOLVE_HINT: Record<SolveFor, string> = {
  timeline: "Dejás todo fijo y te decimos a qué edad podés jubilarte.",
  monthly:
    "Fijás la edad a la que querés jubilarte y calculamos cuánto aportar por mes.",
  initial:
    "Fijás la edad y el aporte; calculamos con cuánta inversión inicial necesitás arrancar hoy.",
};
const ALLOCATION_NOTES: Record<Allocation, string> = {
  aggressive: "rinde más, con más volatilidad",
  balanced: "el balance de la regla del 4%",
  conservative: "muy estable, con rendimiento más bajo",
  custom: "el rendimiento real que vos estimes para tu cartera",
};

/** Is the loaded withdrawal rate not one of the presets? Then it's custom. */
const isCustomWithdrawal = (rate: number) => !WITHDRAWAL_OPTIONS.includes(rate);

/** Retirement profile derived from a set of inputs (withdrawal rate + portfolio). */
const profileFor = (i: PlanInputs): RetirementProfile =>
  deriveProfile(
    i.withdrawalRate,
    i.retirementAllocation,
    isCustomWithdrawal(i.withdrawalRate)
  );

export default function RetirementPlanner() {
  const [inputs, setInputs] = usePersistedState<PlanInputs>(
    "fire.inputs",
    DEFAULT_INPUTS
  );
  const [assumptions, setAssumptions] = usePersistedState<Assumptions>(
    "fire.assumptions",
    DEFAULT_ASSUMPTIONS
  );
  const [currency, setCurrency] = usePersistedState<string>(
    "fire.currency",
    DEFAULT_CURRENCY
  );
  const [currentAge, setCurrentAge] = usePersistedState<number>(
    "fire.currentAge",
    DEFAULT_AGE
  );

  // The withdrawal rate stores only the number; this flag decides whether we show the
  // presets or the custom input. It's initialized from the loaded value.
  const [withdrawalCustom, setWithdrawalCustom] = useState(() =>
    isCustomWithdrawal(inputs.withdrawalRate)
  );

  // The "retirement profile" is a shortcut that sets the withdrawal rate and the
  // portfolio at once. It isn't persisted separately: it's derived from those values (like the flag
  // above). With a preset we hide the fine-grained controls; "custom" reveals them.
  const [profile, setProfile] = useState<RetirementProfile>(() =>
    profileFor(inputs)
  );

  const { dark } = useTheme();

  // Is there an age loaded? The auto-calc is based on retirement age, so without
  // an age (currentAge 0 = "not loaded") it doesn't apply. Matches planSummary.
  const ageMode = currentAge > 0;

  // Are we solving for a value (contribution/initial) instead of computing the age?
  // In "timeline" there's no target retirement age: that field and Coast FIRE
  // don't apply, because there the age is precisely what we're computing.
  const solveMode = inputs.solveFor !== "timeline";

  // Auto-calc: in the "monthly"/"initial" modes we solve for the missing value
  // and inject it into the inputs BEFORE simulating (via applySolve), so that
  // chart, stats, and verdict all tell the same story. `solve` holds the
  // result of the solve to display it in the field. The contribution/initial the user
  // typed is never overwritten: it stays in `inputs` and comes back when switching to "timeline".
  const solve = useMemo(
    () => resolveSolve(inputs, assumptions, currentAge),
    [inputs, assumptions, currentAge]
  );
  const effective = useMemo(
    () => applySolve(inputs, assumptions, currentAge),
    [inputs, assumptions, currentAge]
  );
  const result = useMemo(
    () => computeLifecycle(effective.inputs, effective.assumptions),
    [effective]
  );

  const money = useMemo(() => makeCurrencyFormatter(currency), [currency]);
  const axisFmt = useMemo(() => makeAxisFormatter(currency), [currency]);
  const symbol = currencyByCode(currency).symbol;
  const currencyLabel = currencyByCode(currency).label.toLowerCase();

  function set<K extends keyof PlanInputs>(key: K, value: PlanInputs[K]) {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  // Choosing a profile sets the withdrawal rate and the portfolio at once.
  // "Personalizado" doesn't touch the values: it just reveals the controls to edit them.
  function selectProfile(p: RetirementProfile) {
    setProfile(p);
    if (p === "custom") return;
    const preset = RETIREMENT_PROFILES[p];
    setWithdrawalCustom(false);
    setInputs((prev) => ({
      ...prev,
      withdrawalRate: preset.withdrawalRate,
      retirementAllocation: preset.allocation,
    }));
  }

  function resetAll() {
    setInputs(DEFAULT_INPUTS);
    setAssumptions(DEFAULT_ASSUMPTIONS);
    setCurrency(DEFAULT_CURRENCY);
    setCurrentAge(DEFAULT_AGE);
    setWithdrawalCustom(isCustomWithdrawal(DEFAULT_INPUTS.withdrawalRate));
    setProfile(profileFor(DEFAULT_INPUTS));
  }

  // Everything the user configured, ready to export to a file.
  const planData: PlanData = { inputs, assumptions, currency, currentAge };

  function applyImport(data: PlanData) {
    setInputs(data.inputs);
    setAssumptions(data.assumptions);
    setCurrency(data.currency);
    setCurrentAge(data.currentAge);
    setWithdrawalCustom(isCustomWithdrawal(data.inputs.withdrawalRate));
    setProfile(profileFor(data.inputs));
  }

  // If the URL carries a shared plan (#plan=...), we offer to load it and clear
  // the hash. parsePlanData already validates and sanitizes, so a broken link breaks nothing.
  useEffect(() => {
    const shared = readPlanFromHash();
    if (!shared) return;
    history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search
    );
    if (
      shared.ok &&
      window.confirm(
        "Este enlace contiene un plan. ¿Querés cargarlo? Reemplazará tus datos actuales."
      )
    ) {
      applyImport(shared.data);
    }
    // Only on mount: we read the hash once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Coast FIRE: capital that, without contributing more, compounds up to the
  // retirement number by the target age. Only applies in the solve modes (in
  // "timeline" there's no target age) and if the target retirement is further out.
  const coastApplies =
    solveMode && ageMode && inputs.coastTargetAge > currentAge;
  const coastYears = inputs.coastTargetAge - currentAge;
  const coast = coastNumber(
    result.fireNumber,
    result.accumulationReturn,
    coastYears
  );

  const chartData = useMemo(() => {
    const coastInput =
      coastApplies && isFinite(coast) ? { value: coast, years: coastYears } : null;
    const { accumulation, retirement, coasting, accYears, totalYears } =
      buildChartSeries(result, coastInput);
    const rows: {
      year: number;
      acc: number | null;
      ret: number | null;
      coast: number | null;
    }[] = [];
    // Span the longer of the two horizons: the coast curve can reach further
    // than the accumulation+retirement series (e.g. an "alreadyThere" solve
    // whose retirement depletes before the target age), and it must still land
    // on the target line. acc/ret stay null past their own ranges.
    const lastYear = Math.max(totalYears, coasting.length - 1);
    for (let k = 0; k <= lastYear; k++) {
      rows.push({
        year: k,
        acc: k <= accYears ? Math.round(accumulation[k].value) : null,
        ret:
          result.reached && k >= accYears && k - accYears < retirement.length
            ? Math.round(retirement[k - accYears].value)
            : null,
        coast: k < coasting.length ? Math.round(coasting[k].value) : null,
      });
    }
    return rows;
  }, [result, coastApplies, coast, coastYears]);

  const retColor = result.trend === "decline" ? COLORS.decline : COLORS.grow;
  const axisColor = dark ? "rgba(236,230,216,0.5)" : "rgba(33,29,22,0.5)";
  const gridColor = dark ? "rgba(236,230,216,0.1)" : "rgba(33,29,22,0.08)";

  // Derived narrative (retirement age, summary, and verdict), shared with
  // the PDF through buildPlanSummary. If there's an age loaded we show the
  // real age instead of "years from now".
  const summary = buildPlanSummary(
    result,
    effective.inputs,
    effective.assumptions,
    currentAge,
    { money: (n) => money.format(Math.round(n)), pct: formatPct },
    "screen"
  );
  const { retirementAge, retirementSummary } = summary;

  // Own contributions vs. compound interest (on the balance when reaching the number).
  const contributed = result.contributedAtFire;
  const growth = Math.max(0, result.growthAtFire);
  const breakdownTotal = contributed + growth;
  const contributedPct =
    breakdownTotal > 0 ? (contributed / breakdownTotal) * 100 : 0;

  // In solve mode, what to show in the computed field (contribution or initial):
  // the solved value + a clarification, or "—" with the reason if it isn't possible.
  const solvedField = (() => {
    const kind = inputs.solveFor; // "monthly" | "initial" (doesn't enter in "timeline")
    const suffix = kind === "monthly" ? " / mes" : "";
    if (!ageMode) {
      return {
        ok: false,
        display: "—",
        note: "Cargá tu edad actual arriba para calcular esto.",
      };
    }
    if (!solve) return { ok: false, display: "—", note: "" };
    switch (solve.status) {
      case "ok":
        return {
          ok: true,
          display: `${money.format(Math.round(solve.value))}${suffix}`,
          note: `para jubilarte a los ${inputs.coastTargetAge}`,
        };
      case "alreadyThere":
        return {
          ok: true,
          display: `${money.format(0)}${suffix}`,
          note:
            kind === "monthly"
              ? "Con tu inversión inicial ya llegás a esa edad: no necesitás aportar."
              : "Con tu aporte mensual ya llegás a esa edad: no necesitás inversión inicial.",
        };
      case "noHorizon":
        return {
          ok: false,
          display: "—",
          note: "Elegí una edad de jubilación mayor a tu edad actual.",
        };
      case "unreachable":
        return {
          ok: false,
          display: "—",
          note: "Con esa tasa de retiro tu número es infinito. Subí la tasa de retiro.",
        };
    }
  })();

  return (
    <section className="calc" id="calculadora">
      <div className="calc-inner">
        <div className="section-head">
          <span className="eyebrow">La calculadora</span>
          <h2>Tu plan en números</h2>
          <p>
            Acumulás a ~{formatPct(result.accumulationReturn)} real anual. Al
            jubilarte aplicás la cartera que elijas. Todo en{" "}
            {currencyLabel} de hoy. Cambiás los supuestos en los ajustes avanzados.
          </p>
        </div>

        <DataActions data={planData} onImport={applyImport} />

        <div className="panel">
          <div className="field field-wide">
            <label>
              <span className="label-with-info">
                ¿Qué querés calcular?
                <InfoTip label="Cómo funciona el auto-cálculo">
                  Elegí qué valor querés que la calculadora despeje. Dejás todo
                  lo demás fijo y ese campo se calcula solo para que los números
                  cierren. <strong>Cuándo me jubilo</strong> es el modo clásico;
                  los otros dos fijan la edad de jubilación y despejan el aporte
                  o la inversión inicial.
                </InfoTip>
              </span>
            </label>
            <SegmentedControl
              options={SOLVE_OPTIONS}
              value={inputs.solveFor}
              onChange={(v) => set("solveFor", v)}
              ariaLabel="¿Qué querés calcular?"
            />
            <small>{SOLVE_HINT[inputs.solveFor]}</small>
          </div>

          <div className="field">
            <label>Edad actual</label>
            <div className="years-input">
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={currentAge}
                onChange={(e) => setCurrentAge(Number(e.target.value))}
              />
              <span>años</span>
            </div>
            <small>Para mostrar tu edad en el gráfico y en los datos de jubilación.</small>
          </div>

          {ageMode && solveMode && (
            <div className="field">
              <label>
                <span className="label-with-info">
                  Edad de jubilación objetivo
                  <InfoTip label="Qué es Coast FIRE">
                    <strong>Coast FIRE</strong> es el capital que, sin aportar un
                    peso más, crece solo hasta tu número de retiro para cuando
                    cumplas esta edad. Si ya lo tenés, podrías dejar de aportar y
                    aun así llegar.
                  </InfoTip>
                </span>
              </label>
              <div className="years-input">
                <input
                  type="number"
                  min={currentAge + 1}
                  max={100}
                  step={1}
                  value={inputs.coastTargetAge}
                  onChange={(e) => set("coastTargetAge", Number(e.target.value))}
                />
                <span>años</span>
              </div>
              <small>
                {inputs.solveFor === "monthly"
                  ? "Ajustamos el aporte mensual para que llegues justo a esta edad."
                  : "Ajustamos la inversión inicial para que llegues justo a esta edad."}
              </small>
            </div>
          )}

          {inputs.solveFor === "initial" ? (
            <SolvedField label="Inversión inicial" {...solvedField} />
          ) : (
            <div className="field">
              <label>Inversión inicial</label>
              <MoneyInput
                value={inputs.initial}
                onChange={(v) => set("initial", v)}
                symbol={symbol}
                step={500}
                ariaLabel="Inversión inicial"
              />
            </div>
          )}

          {inputs.solveFor === "monthly" ? (
            <SolvedField label="Aporte mensual" {...solvedField} />
          ) : (
            <div className="field">
              <label>Aporte mensual</label>
              <MoneyInput
                value={inputs.monthly}
                onChange={(v) => set("monthly", v)}
                symbol={symbol}
                step={100}
                ariaLabel="Aporte mensual"
              />
            </div>
          )}

          <div className="field">
            <label>
              <span className="label-with-info">
                Aumento anual del aporte
                <InfoTip label="Qué es el aumento anual del aporte">
                  Cuánto sube tu aporte mensual cada año, en{" "}
                  <strong>términos reales</strong> (por encima de la inflación).
                  Útil si esperás aumentos de sueldo. <strong>0</strong> = aporte
                  constante en poder de compra de hoy.
                </InfoTip>
              </span>
            </label>
            <PercentInput
              value={inputs.monthlyGrowth}
              onChange={(v) => set("monthlyGrowth", v)}
              step={0.5}
              max={20}
              ariaLabel="Aumento anual del aporte"
            />
            <small>Crecimiento real de tu aporte por año. 0 = constante.</small>
          </div>

          <div className="field">
            <label>
              <span className="label-with-info">
                Gasto mensual hoy
                <InfoTip label="Qué significa el gasto en valores de hoy">
                  Cuánto gastás por mes para vivir, en{" "}
                  <strong>poder de compra de hoy</strong>. El modelo trabaja en
                  términos reales (la inflación ya está descontada), así que este
                  número se mantiene constante en el tiempo, no hace falta
                  ajustarlo a futuro.
                </InfoTip>
              </span>
            </label>
            <MoneyInput
              value={inputs.monthlySpend}
              onChange={(v) => set("monthlySpend", v)}
              symbol={symbol}
              step={100}
              ariaLabel="Gasto mensual hoy"
            />
          </div>

          <div className="field field-wide">
            <label>
              <span className="label-with-info">
                Perfil de retiro
                <InfoTip label="Qué es el perfil de retiro">
                  Un atajo que fija de una vez tu <strong>tasa de retiro</strong>{" "}
                  y tu <strong>cartera en el retiro</strong>, ordenado de más a
                  menos riesgo. Elegí <strong>Personalizado</strong> para ajustar
                  cada uno a mano.
                </InfoTip>
              </span>
            </label>
            <SegmentedControl
              options={RETIREMENT_PROFILE_ORDER.map((p) => ({
                value: p,
                label: RETIREMENT_PROFILE_LABELS[p],
              }))}
              value={profile}
              onChange={selectProfile}
              ariaLabel="Perfil de retiro"
            />
            {profile === "custom" ? (
              <small>Ajustá la tasa de retiro y la cartera a tu gusto, abajo.</small>
            ) : (
              <small>
                {ALLOCATION_LABELS[inputs.retirementAllocation]} · retiro{" "}
                {formatPct(inputs.withdrawalRate)} · rinde ~
                {formatPct(result.retirementReturn)} real
              </small>
            )}
          </div>

          {profile === "custom" && (
            <>
              <div className="field field-wide">
                <label>
                  <span className="label-with-info">
                    Tasa de retiro
                    <InfoTip label="Qué es la tasa de retiro">
                      Es el porcentaje de tu cartera que retirás cada año para
                      vivir. La <strong>regla del 4%</strong> sugiere que retirar
                      ~4% anual es históricamente sostenible. Una tasa más baja
                      necesita más capital pero te deja más margen. Una más alta
                      necesita menos capital pero sube el riesgo de quedarte
                      corto. Tu número de
                      retiro = gasto anual ÷ tasa.
                    </InfoTip>
                  </span>
                </label>
                <SegmentedWithCustom
                  options={WITHDRAWAL_OPTIONS.map((w) => ({
                    value: w,
                    label: formatPct(w),
                  }))}
                  isPresetActive={(w) =>
                    !withdrawalCustom && inputs.withdrawalRate === w
                  }
                  onSelectPreset={(w) => {
                    set("withdrawalRate", w);
                    setWithdrawalCustom(false);
                  }}
                  customActive={withdrawalCustom}
                  onSelectCustom={() => setWithdrawalCustom(true)}
                  ariaLabel="Tasa de retiro"
                >
                  <PercentInput
                    value={inputs.withdrawalRate}
                    onChange={(v) => set("withdrawalRate", v)}
                    step={0.1}
                    max={20}
                    ariaLabel="Tasa de retiro personalizada"
                  />
                </SegmentedWithCustom>
                <small>
                  % de la cartera que retirás al año. Define tu número de retiro.
                </small>
              </div>

              <div className="field field-wide">
                <label>
                  <span className="label-with-info">
                    Cartera en el retiro
                    <InfoTip label="Qué es la cartera en el retiro">
                      La mezcla de acciones y bonos cuando te jubilás. Más
                      acciones rinde más pero con más volatilidad. Más bonos es
                      más estable pero rinde menos. Podés editar el rendimiento
                      de cada una en los <strong>ajustes avanzados</strong>, o
                      elegir <strong>Personalizada</strong> para fijar el
                      rendimiento a mano.
                    </InfoTip>
                  </span>
                </label>
                <SegmentedWithCustom
                  options={ALLOCATIONS.map((a) => ({
                    value: a,
                    label: ALLOCATION_LABELS[a],
                  }))}
                  isPresetActive={(a) => inputs.retirementAllocation === a}
                  onSelectPreset={(a) => set("retirementAllocation", a)}
                  customActive={inputs.retirementAllocation === "custom"}
                  onSelectCustom={() => set("retirementAllocation", "custom")}
                  customLabel={ALLOCATION_LABELS.custom}
                  ariaLabel="Cartera en el retiro"
                >
                  <PercentInput
                    value={inputs.customRetirementReturn}
                    onChange={(v) => set("customRetirementReturn", v)}
                    step={0.5}
                    max={30}
                    ariaLabel="Rendimiento de la cartera personalizada"
                  />
                </SegmentedWithCustom>
                <small>
                  {ALLOCATION_LABELS[inputs.retirementAllocation]} · ~
                  {formatPct(result.retirementReturn)} real —{" "}
                  {ALLOCATION_NOTES[inputs.retirementAllocation]}
                </small>
              </div>
            </>
          )}
        </div>

        <AdvancedSettings
          assumptions={assumptions}
          setAssumptions={setAssumptions}
          currency={currency}
          setCurrency={setCurrency}
          onReset={resetAll}
        />

        <section className="stats">
          <div className="stat">
            <span>Tu número de retiro (hoy)</span>
            <strong>
              {isFinite(result.fireNumber)
                ? money.format(Math.round(result.fireNumber))
                : "—"}
            </strong>
          </div>
          <div className="stat">
            <span>
              {result.reached
                ? ageMode
                  ? `Te jubilás · en ${result.accumulationYears} ${
                      result.accumulationYears === 1 ? "año" : "años"
                    }`
                  : "Años aportando para llegar"
                : ageMode
                ? "Edad de jubilación"
                : "Años aportando para llegar"}
            </span>
            <strong>
              {result.reached
                ? ageMode
                  ? `${retirementAge} años`
                  : `${result.accumulationYears}`
                : ageMode
                ? "—"
                : `${assumptions.maxAccumulationYears}+`}
            </strong>
          </div>
          <div className="stat">
            <span>
              En el retiro tu dinero{" "}
              <InfoTip label="Por qué puede decir que dura para siempre">
                Es una proyección a rendimiento{" "}
                <strong>real promedio y constante</strong>: si tu cartera rinde
                más de lo que retirás cada año, matemáticamente el dinero nunca
                se agota. Ojo: el mercado real sube y baja, así que la{" "}
                <strong>regla del 4%</strong> apunta a que dure al menos ~30 años
                como colchón ante malas rachas, sobre todo al inicio del retiro.
              </InfoTip>
            </span>
            <strong>{retirementSummary}</strong>
          </div>
          {coastApplies && (
            <div className="stat">
              <span>Coast FIRE · jubilación a los {inputs.coastTargetAge}</span>
              <strong>
                {isFinite(coast) ? money.format(Math.round(coast)) : "—"}
              </strong>
            </div>
          )}
        </section>

        {result.reached && breakdownTotal > 0 && (
          <section
            className="breakdown"
            aria-label="Aportes propios contra interés compuesto"
          >
            <div className="breakdown-bar">
              <span
                style={{
                  width: `${contributedPct}%`,
                  background: COLORS.accumulation,
                }}
              />
              <span
                style={{
                  width: `${100 - contributedPct}%`,
                  background: COLORS.grow,
                }}
              />
            </div>
            <div className="breakdown-legend">
              <span>
                <i style={{ background: COLORS.accumulation }} />
                Aportaste {money.format(Math.round(contributed))}
              </span>
              <span>
                <i style={{ background: COLORS.grow }} />
                El interés generó {money.format(Math.round(growth))}
              </span>
            </div>
          </section>
        )}

        <StatusBanner kind={summary.kind}>{summary.verdict}</StatusBanner>

        <section className="chart-card">
          <div className="legend">
            <span>
              <i style={{ background: COLORS.accumulation }} />
              Acumulando
            </span>
            {result.reached && (
              <span>
                <i style={{ background: retColor }} />
                En el retiro
              </span>
            )}
            <span>
              <i className="dash" style={{ borderTopColor: COLORS.target }} />
              Tu número de retiro
            </span>
          </div>

          <div className="chart-wrap">
            <ResponsiveContainer>
              <ComposedChart
                data={chartData}
                margin={{ top: 16, right: 12, bottom: 12, left: 4 }}
              >
                <CartesianGrid stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="year"
                  stroke={axisColor}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  tickFormatter={(v) =>
                    ageMode ? `${currentAge + Number(v)}` : `${v}`
                  }
                  label={{
                    value: ageMode ? "Edad" : "Años desde hoy",
                    position: "insideBottom",
                    offset: -6,
                    fill: axisColor,
                    fontSize: 12,
                  }}
                />
                <YAxis
                  stroke={axisColor}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  tickFormatter={axisFmt}
                  width={56}
                />
                <Tooltip
                  formatter={(value, name) => [
                    money.format(Number(value)),
                    name === "acc"
                      ? "Acumulando"
                      : name === "coast"
                      ? "Coast FIRE (sin aportar)"
                      : "En el retiro",
                  ]}
                  labelFormatter={(label) =>
                    ageMode ? `${currentAge + Number(label)} años` : `Año ${label}`
                  }
                  contentStyle={{
                    background: dark ? "#1E1B15" : "#FFFEFB",
                    border: `1px solid ${gridColor}`,
                    borderRadius: 8,
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    fontSize: 13,
                    color: dark ? "#ECE6D8" : "#211D16",
                  }}
                />
                {isFinite(result.fireNumber) && (
                  <ReferenceLine
                    y={result.fireNumber}
                    stroke={COLORS.target}
                    strokeDasharray="6 5"
                  />
                )}
                {result.reached && (
                  <ReferenceLine
                    className="ref-jubilas"
                    x={result.accumulationYears}
                    stroke={axisColor}
                    strokeDasharray="4 4"
                    label={{
                      value: ageMode ? `te jubilás · ${retirementAge}` : "te jubilás",
                      position: "top",
                      fill: axisColor,
                      fontSize: 11,
                    }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="acc"
                  stroke={COLORS.accumulation}
                  strokeWidth={2}
                  fill={COLORS.accumulation}
                  fillOpacity={dark ? 0.16 : 0.1}
                  connectNulls={false}
                  dot={false}
                  isAnimationActive={false}
                />
                {/* Coast FIRE "ghost": coasting to the target without contributing. */}
                <Line
                  type="monotone"
                  dataKey="coast"
                  stroke={COLORS.coast}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  connectNulls={false}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="ret"
                  stroke={retColor}
                  strokeWidth={2}
                  connectNulls={false}
                  dot={false}
                  isAnimationActive={false}
                />
                {coastApplies && isFinite(coast) && (
                  <ReferenceDot
                    x={0}
                    y={Math.round(coast)}
                    r={3}
                    fill={COLORS.coast}
                    stroke="none"
                    label={{
                      value: "Coast FIRE",
                      position: "right",
                      fill: COLORS.coast,
                      fontSize: 11,
                    }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </section>
  );
}
