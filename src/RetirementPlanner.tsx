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
  ALLOCATION_LABELS,
  ALLOCATIONS,
  DEFAULT_AGE,
  DEFAULT_ASSUMPTIONS,
  DEFAULT_INPUTS,
  type Allocation,
  type Assumptions,
  type PlanInputs,
} from "./finance";
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  currencyByCode,
  makeAxisFormatter,
  makeCurrencyFormatter,
  formatPct,
} from "./format";
import { usePersistedState } from "./usePersistedState";
import { AdvancedSettings } from "./components/AdvancedSettings";
import { PercentInput } from "./components/PercentInput";
import { InfoTip } from "./components/InfoTip";
import { DataActions } from "./components/DataActions";
import { type PlanData } from "./exportData";

const COLORS = {
  accumulation: "#2B5B8A",
  grow: "#1E7A52",
  decline: "#B23A2E",
  target: "#B07D18",
};

const WITHDRAWAL_OPTIONS = [0.03, 0.035, 0.04];
const ALLOCATION_NOTES: Record<Allocation, string> = {
  aggressive: "máximo rendimiento, máxima volatilidad",
  balanced: "el clásico balance de la regla del 4%",
  conservative: "muy estable, pero puede no rendir lo suficiente",
  custom: "el rendimiento real que vos estimes para tu cartera",
};

function useDarkMode() {
  const [dark, setDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return dark;
}

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

  const dark = useDarkMode();
  const result = useMemo(
    () => computeLifecycle(inputs, assumptions),
    [inputs, assumptions]
  );

  const money = useMemo(() => makeCurrencyFormatter(currency), [currency]);
  const axisFmt = useMemo(() => makeAxisFormatter(currency), [currency]);
  const symbol = currencyByCode(currency).symbol;
  const currencyLabel = currencyByCode(currency).label.toLowerCase();

  function set<K extends keyof PlanInputs>(key: K, value: PlanInputs[K]) {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  function resetAll() {
    setInputs(DEFAULT_INPUTS);
    setAssumptions(DEFAULT_ASSUMPTIONS);
    setCurrency(DEFAULT_CURRENCY);
    setCurrentAge(DEFAULT_AGE);
  }

  // Todo lo que el usuario configuró, listo para exportar a un archivo.
  const planData: PlanData = { inputs, assumptions, currency, currentAge };

  function applyImport(data: PlanData) {
    setInputs(data.inputs);
    setAssumptions(data.assumptions);
    setCurrency(data.currency);
    setCurrentAge(data.currentAge);
  }

  const chartData = useMemo(() => {
    const accYears = result.accumulationYears;
    const retLen =
      result.retirementSeries.length > 0 ? result.retirementSeries.length - 1 : 0;
    const total = accYears + retLen;
    const rows: { year: number; acc: number | null; ret: number | null }[] = [];
    for (let k = 0; k <= total; k++) {
      rows.push({
        year: k,
        acc: k <= accYears ? Math.round(result.accumulationSeries[k]) : null,
        ret:
          result.reached && k >= accYears
            ? Math.round(result.retirementSeries[k - accYears])
            : null,
      });
    }
    return rows;
  }, [result]);

  const retColor = result.trend === "decline" ? COLORS.decline : COLORS.grow;
  const axisColor = dark ? "rgba(236,230,216,0.5)" : "rgba(33,29,22,0.5)";
  const gridColor = dark ? "rgba(236,230,216,0.1)" : "rgba(33,29,22,0.08)";

  // Si hay edad cargada mostramos la edad real en vez de "años desde hoy".
  const ageMode = currentAge > 0;
  const retirementAge = currentAge + result.accumulationYears;
  const depletionAge =
    result.depletionYear != null ? retirementAge + result.depletionYear : null;
  const jubilasFrase = ageMode
    ? `Te jubilás a los ${retirementAge} años`
    : `Te jubilás al año ${result.accumulationYears}`;

  const retirementSummary = !result.reached
    ? "—"
    : result.trend === "decline"
    ? ageMode
      ? `Se agota a los ~${depletionAge} años`
      : `Se agota ~año ${result.depletionYear}`
    : "Dura indefinidamente";

  let statusClass = "status ok";
  let statusText: string;
  if (!result.reached) {
    statusClass = "status warn";
    statusText = `Con ${money.format(inputs.monthly)}/mes no alcanzás tu número (${money.format(
      Math.round(result.fireNumber)
    )}) en ${assumptions.maxAccumulationYears} años. Subí el aporte o bajá el gasto.`;
  } else if (result.trend === "decline") {
    statusClass = "status bad";
    statusText = `${jubilasFrase}, pero con ${
      ALLOCATION_LABELS[inputs.retirementAllocation]
    } (~${formatPct(
      result.retirementReturn
    )} real) tu cartera rinde menos de lo que retirás: empieza a achicarse y se agota ${
      ageMode
        ? `alrededor de los ${depletionAge} años`
        : `alrededor del año ${result.depletionYear} del retiro`
    }. Necesitás una tasa de retiro más baja, o más capital.`;
  } else {
    statusClass = "status ok";
    statusText = `${jubilasFrase} y tu cartera (${
      ALLOCATION_LABELS[inputs.retirementAllocation]
    }) aguanta el retiro${
      result.trend === "grow" ? " — de hecho, sigue creciendo" : ""
    }. Tu ${formatPct(inputs.withdrawalRate)} es sostenible con este rendimiento.`;
  }

  return (
    <section className="calc" id="calculadora">
      <div className="calc-inner">
        <div className="section-head">
          <span className="eyebrow">La calculadora</span>
          <h2>Tu plan en números</h2>
          <p>
            Acumulás en un ETF global (~{formatPct(result.accumulationReturn)} real
            anual); al jubilarte aplicás la cartera que elijas. Todo en{" "}
            {currencyLabel} de hoy. ¿Otros supuestos? Abrí los ajustes avanzados.
          </p>
        </div>

        <DataActions data={planData} onImport={applyImport} />

        <div className="panel">
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
                Tasa de retiro
                <InfoTip label="Qué es la tasa de retiro">
                  Es el porcentaje de tu cartera que retirás cada año para vivir.
                  La <strong>regla del 4%</strong> sugiere que retirar ~4% anual
                  es históricamente sostenible. Más baja = más margen, pero
                  necesitás más capital; más alta = menos capital, pero más
                  riesgo de quedarte corto. Tu número de retiro = gasto anual ÷
                  tasa.
                </InfoTip>
              </span>
            </label>
            <div className="seg">
              {WITHDRAWAL_OPTIONS.map((w) => (
                <button
                  key={w}
                  className={inputs.withdrawalRate === w ? "active" : ""}
                  onClick={() => set("withdrawalRate", w)}
                >
                  {formatPct(w)}
                </button>
              ))}
              <div className="custom-rate">
                <span>Otra:</span>
                <PercentInput
                  value={inputs.withdrawalRate}
                  onChange={(v) => set("withdrawalRate", v)}
                  step={0.1}
                  max={20}
                  ariaLabel="Tasa de retiro personalizada"
                />
              </div>
            </div>
            <small>% de la cartera que retirás al año. Define tu número de retiro.</small>
          </div>

          <div className="field field-wide">
            <label>
              <span className="label-with-info">
                Cartera en el retiro
                <InfoTip label="Qué es la cartera en el retiro">
                  La mezcla de acciones y bonos cuando te jubilás. Más acciones
                  rinde más, pero con más volatilidad; más bonos es más estable,
                  pero rinde menos. Podés editar el rendimiento de cada una en
                  los <strong>ajustes avanzados</strong>, o elegir{" "}
                  <strong>Personalizada</strong> para fijar el rendimiento a mano.
                </InfoTip>
              </span>
            </label>
            <div className="seg">
              {ALLOCATIONS.map((a) => (
                <button
                  key={a}
                  className={inputs.retirementAllocation === a ? "active" : ""}
                  onClick={() => set("retirementAllocation", a)}
                >
                  {ALLOCATION_LABELS[a]}
                </button>
              ))}
              <div className="custom-rate">
                <button
                  className={
                    inputs.retirementAllocation === "custom" ? "active" : ""
                  }
                  onClick={() => set("retirementAllocation", "custom")}
                >
                  {ALLOCATION_LABELS.custom}
                </button>
                {inputs.retirementAllocation === "custom" && (
                  <PercentInput
                    value={inputs.customRetirementReturn}
                    onChange={(v) => set("customRetirementReturn", v)}
                    step={0.5}
                    max={30}
                    ariaLabel="Rendimiento de la cartera personalizada"
                  />
                )}
              </div>
            </div>
            <small>
              {ALLOCATION_LABELS[inputs.retirementAllocation]} · ~
              {formatPct(result.retirementReturn)} real —{" "}
              {ALLOCATION_NOTES[inputs.retirementAllocation]}
            </small>
          </div>
        </div>

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
        </section>

        <div className={statusClass}>{statusText}</div>

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

          <div style={{ width: "100%", height: 360 }}>
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

        <AdvancedSettings
          assumptions={assumptions}
          setAssumptions={setAssumptions}
          currency={currency}
          setCurrency={setCurrency}
          onReset={resetAll}
        />
      </div>
    </section>
  );
}
