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
import { InfoTip } from "./components/InfoTip";
import { DataActions } from "./components/DataActions";
import { SegmentedControl } from "./components/SegmentedControl";
import { SegmentedWithCustom } from "./components/SegmentedWithCustom";
import { SolvedField } from "./components/SolvedField";
import { StatusBanner } from "./components/StatusBanner";
import { type PlanData } from "./exportData";
import { readPlanFromHash } from "./shareUrl";

const WITHDRAWAL_OPTIONS = [0.03, 0.035, 0.04];

/** Modos del selector "¿Qué querés calcular?" (auto-cálculo). */
const SOLVE_OPTIONS: { value: SolveFor; label: string }[] = [
  { value: "timeline", label: "Cuándo me jubilo" },
  { value: "monthly", label: "Cuánto aportar" },
  { value: "initial", label: "Inversión inicial" },
];

/** La bajada que explica, en cada modo, qué queda fijo y qué se calcula. */
const SOLVE_HINT: Record<SolveFor, string> = {
  timeline: "Dejás todo fijo y te decimos a qué edad podés jubilarte.",
  monthly:
    "Fijás la edad a la que querés jubilarte y calculamos cuánto aportar por mes.",
  initial:
    "Fijás la edad y el aporte; calculamos con cuánta inversión inicial necesitás arrancar hoy.",
};
const ALLOCATION_NOTES: Record<Allocation, string> = {
  aggressive: "máximo rendimiento, máxima volatilidad",
  balanced: "el clásico balance de la regla del 4%",
  conservative: "muy estable, pero puede no rendir lo suficiente",
  custom: "el rendimiento real que vos estimes para tu cartera",
};

/** ¿La tasa de retiro cargada no es uno de los presets? Entonces es personalizada. */
const isCustomWithdrawal = (rate: number) => !WITHDRAWAL_OPTIONS.includes(rate);

/** Perfil de retiro derivado de un set de inputs (tasa de retiro + cartera). */
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

  // La tasa de retiro guarda solo el número; este flag decide si mostramos los
  // presets o el input personalizado. Se inicializa según el valor cargado.
  const [withdrawalCustom, setWithdrawalCustom] = useState(() =>
    isCustomWithdrawal(inputs.withdrawalRate)
  );

  // El "perfil de retiro" es un atajo que fija a la vez la tasa de retiro y la
  // cartera. No se persiste aparte: se deriva de esos valores (igual que el flag
  // de arriba). Con un preset ocultamos los controles finos; "custom" los revela.
  const [profile, setProfile] = useState<RetirementProfile>(() =>
    profileFor(inputs)
  );

  const { dark } = useTheme();

  // ¿Hay edad cargada? El auto-cálculo es por edad de jubilación, así que sin
  // edad (currentAge 0 = "sin cargar") no aplica. Coincide con planSummary.
  const ageMode = currentAge > 0;

  // ¿Estamos despejando un valor (aporte/inicial) en vez de calcular la edad?
  // En "timeline" no hay edad de jubilación objetivo: ese campo y Coast FIRE
  // no aplican, porque ahí la edad es justamente lo que calculamos.
  const solveMode = inputs.solveFor !== "timeline";

  // Auto-cálculo: en los modos "monthly"/"initial" despejamos el valor que falta
  // y lo inyectamos en los inputs ANTES de simular (vía applySolve), de modo que
  // gráfico, stats y veredicto cuenten la misma historia. `solve` guarda el
  // resultado del despeje para mostrarlo en el campo. El aporte/inicial que tipeó
  // el usuario nunca se pisa: queda en `inputs` y vuelve al pasar a "timeline".
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

  // Elegir un perfil fija de una vez la tasa de retiro y la cartera.
  // "Personalizado" no toca los valores: solo revela los controles para editarlos.
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

  // Todo lo que el usuario configuró, listo para exportar a un archivo.
  const planData: PlanData = { inputs, assumptions, currency, currentAge };

  function applyImport(data: PlanData) {
    setInputs(data.inputs);
    setAssumptions(data.assumptions);
    setCurrency(data.currency);
    setCurrentAge(data.currentAge);
    setWithdrawalCustom(isCustomWithdrawal(data.inputs.withdrawalRate));
    setProfile(profileFor(data.inputs));
  }

  // Si la URL trae un plan compartido (#plan=...), ofrecemos cargarlo y limpiamos
  // el hash. parsePlanData ya valida y sanea, así que un enlace roto no rompe nada.
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
    // Solo al montar: leemos el hash una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chartData = useMemo(() => {
    const { accumulation, retirement, accYears, totalYears } =
      buildChartSeries(result);
    const rows: { year: number; acc: number | null; ret: number | null }[] = [];
    for (let k = 0; k <= totalYears; k++) {
      rows.push({
        year: k,
        acc: k <= accYears ? Math.round(accumulation[k].value) : null,
        ret:
          result.reached && k >= accYears
            ? Math.round(retirement[k - accYears].value)
            : null,
      });
    }
    return rows;
  }, [result]);

  const retColor = result.trend === "decline" ? COLORS.decline : COLORS.grow;
  const axisColor = dark ? "rgba(236,230,216,0.5)" : "rgba(33,29,22,0.5)";
  const gridColor = dark ? "rgba(236,230,216,0.1)" : "rgba(33,29,22,0.08)";

  // Narrativa derivada (edad de jubilación, resumen y veredicto), compartida con
  // el PDF a través de buildPlanSummary. Si hay edad cargada mostramos la edad
  // real en vez de "años desde hoy".
  const summary = buildPlanSummary(
    result,
    effective.inputs,
    effective.assumptions,
    currentAge,
    { money: (n) => money.format(Math.round(n)), pct: formatPct },
    "screen"
  );
  const { retirementAge, retirementSummary } = summary;

  // Coast FIRE: capital que, sin aportar más, capitaliza hasta el número de
  // retiro para la edad objetivo. Solo aplica en los modos de despeje (en
  // "timeline" no hay edad objetivo) y si la jubilación objetivo es más adelante.
  const coastApplies =
    solveMode && ageMode && inputs.coastTargetAge > currentAge;
  const coast = coastNumber(
    result.fireNumber,
    result.accumulationReturn,
    inputs.coastTargetAge - currentAge
  );

  // Aportes propios vs. interés compuesto (sobre el saldo al llegar al número).
  const contributed = result.contributedAtFire;
  const growth = Math.max(0, result.growthAtFire);
  const breakdownTotal = contributed + growth;
  const contributedPct =
    breakdownTotal > 0 ? (contributed / breakdownTotal) * 100 : 0;

  // En modo despeje, qué mostrar en el campo calculado (aporte o inicial):
  // el valor resuelto + una aclaración, o "—" con el motivo si no es posible.
  const solvedField = (() => {
    const kind = inputs.solveFor; // "monthly" | "initial" (no entra en "timeline")
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
            Acumulás a ~{formatPct(result.accumulationReturn)} real anual; al
            jubilarte aplicás la cartera que elijas. Todo en{" "}
            {currencyLabel} de hoy. ¿Otros supuestos? Abrí los ajustes avanzados.
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
              <div className="money">
                <span>{symbol}</span>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={inputs.initial}
                  onChange={(e) => set("initial", Number(e.target.value))}
                />
              </div>
            </div>
          )}

          {inputs.solveFor === "monthly" ? (
            <SolvedField label="Aporte mensual" {...solvedField} />
          ) : (
            <div className="field">
              <label>Aporte mensual</label>
              <div className="money">
                <span>{symbol}</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={inputs.monthly}
                  onChange={(e) => set("monthly", Number(e.target.value))}
                />
              </div>
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
                  número se mantiene constante en el tiempo: no hace falta que lo
                  “infles” a futuro.
                </InfoTip>
              </span>
            </label>
            <div className="money">
              <span>{symbol}</span>
              <input
                type="number"
                min={0}
                step={100}
                value={inputs.monthlySpend}
                onChange={(e) => set("monthlySpend", Number(e.target.value))}
              />
            </div>
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
                      ~4% anual es históricamente sostenible. Más baja = más
                      margen, pero necesitás más capital; más alta = menos
                      capital, pero más riesgo de quedarte corto. Tu número de
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
                      acciones rinde más, pero con más volatilidad; más bonos es
                      más estable, pero rinde menos. Podés editar el rendimiento
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
            <span>En el retiro tu dinero</span>
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
                    name === "acc" ? "Acumulando" : "En el retiro",
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
                <Line
                  type="monotone"
                  dataKey="ret"
                  stroke={retColor}
                  strokeWidth={2}
                  connectNulls={false}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </section>
  );
}
