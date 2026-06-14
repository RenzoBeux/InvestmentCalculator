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
  RETIREMENT_REAL_RETURNS,
  ACCUMULATION_REAL_RETURN,
  type Allocation,
  type PlanInputs,
} from "./finance";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const pct = (x: number) => (x * 100).toString().replace(".", ",") + "%";

const COLORS = {
  accumulation: "#2B5B8A",
  grow: "#1E7A52",
  decline: "#B23A2E",
  target: "#B07D18",
};

const WITHDRAWAL_OPTIONS = [0.03, 0.035, 0.04];
const ALLOCATIONS: Allocation[] = ["aggressive", "balanced", "conservative"];
const ALLOCATION_NOTES: Record<Allocation, string> = {
  aggressive: "máximo rendimiento, máxima volatilidad",
  balanced: "el clásico balance de la regla del 4%",
  conservative: "muy estable, pero puede no rendir lo suficiente",
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
  const [inputs, setInputs] = useState<PlanInputs>({
    initial: 6000,
    monthly: 1000,
    monthlySpend: 2000,
    withdrawalRate: 0.04,
    retirementAllocation: "balanced",
  });

  const dark = useDarkMode();
  const result = useMemo(() => computeLifecycle(inputs), [inputs]);

  function set<K extends keyof PlanInputs>(key: K, value: PlanInputs[K]) {
    setInputs((prev) => ({ ...prev, [key]: value }));
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

  const retirementSummary = !result.reached
    ? "—"
    : result.trend === "decline"
    ? `Se agota ~año ${result.depletionYear}`
    : "Dura indefinidamente";

  let statusClass = "status ok";
  let statusText: string;
  if (!result.reached) {
    statusClass = "status warn";
    statusText = `Con ${usd.format(inputs.monthly)}/mes no alcanzás tu número (${usd.format(
      Math.round(result.fireNumber)
    )}) en 60 años. Subí el aporte o bajá el gasto.`;
  } else if (result.trend === "decline") {
    statusClass = "status bad";
    statusText = `Te jubilás al año ${result.accumulationYears}, pero con ${
      ALLOCATION_LABELS[inputs.retirementAllocation]
    } (~${pct(
      result.retirementReturn
    )} real) tu cartera rinde menos de lo que retirás: empieza a achicarse y se agota alrededor del año ${
      result.depletionYear
    } del retiro. Necesitás una tasa de retiro más baja, o más capital.`;
  } else {
    statusClass = "status ok";
    statusText = `Te jubilás al año ${result.accumulationYears} y tu cartera (${
      ALLOCATION_LABELS[inputs.retirementAllocation]
    }) aguanta el retiro${
      result.trend === "grow" ? " — de hecho, sigue creciendo" : ""
    }. Tu ${pct(inputs.withdrawalRate)} es sostenible con este rendimiento.`;
  }

  const yTickFormatter = (v: number) =>
    v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`;

  return (
    <div className="app">
      <header className="header reveal">
        <h1>Planificador de retiro</h1>
        <p>
          Cuánto tenés que aportar para poder vivir de tu cartera. Acumulás en un ETF
          global (~{pct(ACCUMULATION_REAL_RETURN)} real anual); al jubilarte aplicás la
          cartera que elijas. Todo en dólares de hoy.
        </p>
      </header>

      <section className="panel reveal">
        <div className="field">
          <label>Inversión inicial</label>
          <div className="money">
            <span>US$</span>
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
          <label>
            Aporte mensual <strong>{usd.format(inputs.monthly)}</strong>
          </label>
          <input
            type="range"
            min={0}
            max={10000}
            step={50}
            value={inputs.monthly}
            onChange={(e) => set("monthly", Number(e.target.value))}
          />
        </div>

        <div className="field">
          <label>Gasto mensual hoy</label>
          <div className="money">
            <span>US$</span>
            <input
              type="number"
              min={0}
              step={100}
              value={inputs.monthlySpend}
              onChange={(e) => set("monthlySpend", Number(e.target.value))}
            />
          </div>
        </div>

        <div className="field">
          <label>Tasa de retiro</label>
          <div className="seg">
            {WITHDRAWAL_OPTIONS.map((w) => (
              <button
                key={w}
                className={inputs.withdrawalRate === w ? "active" : ""}
                onClick={() => set("withdrawalRate", w)}
              >
                {pct(w)}
              </button>
            ))}
          </div>
          <small>% de la cartera que retirás al año. Define tu número de retiro.</small>
        </div>

        <div className="field">
          <label>Cartera en el retiro</label>
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
          </div>
          <small>
            {ALLOCATION_LABELS[inputs.retirementAllocation]} · ~
            {pct(RETIREMENT_REAL_RETURNS[inputs.retirementAllocation])} real —{" "}
            {ALLOCATION_NOTES[inputs.retirementAllocation]}
          </small>
        </div>
      </section>

      <section className="stats reveal">
        <div className="stat">
          <span>Tu número de retiro (hoy)</span>
          <strong>
            {isFinite(result.fireNumber) ? usd.format(Math.round(result.fireNumber)) : "—"}
          </strong>
        </div>
        <div className="stat">
          <span>Años aportando para llegar</span>
          <strong>{result.reached ? `${result.accumulationYears}` : "60+"}</strong>
        </div>
        <div className="stat">
          <span>En el retiro tu dinero</span>
          <strong>{retirementSummary}</strong>
        </div>
      </section>

      <div className={statusClass + " reveal"}>{statusText}</div>

      <section className="chart-card reveal">
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
            <ComposedChart data={chartData} margin={{ top: 16, right: 12, bottom: 12, left: 4 }}>
              <CartesianGrid stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="year"
                stroke={axisColor}
                tick={{ fontSize: 12 }}
                tickLine={false}
                label={{
                  value: "Años desde hoy",
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
                tickFormatter={yTickFormatter}
                width={48}
              />
              <Tooltip
                formatter={(value, name) => [
                  usd.format(Number(value)),
                  name === "acc" ? "Acumulando" : "En el retiro",
                ]}
                labelFormatter={(label) => `Año ${label}`}
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
                <ReferenceLine y={result.fireNumber} stroke={COLORS.target} strokeDasharray="6 5" />
              )}
              {result.reached && (
                <ReferenceLine
                  x={result.accumulationYears}
                  stroke={axisColor}
                  strokeDasharray="4 4"
                  label={{ value: "te jubilás", position: "top", fill: axisColor, fontSize: 11 }}
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

      <footer className="foot reveal">
        Modelo determinista con rendimientos promedio: no incluye el riesgo de secuencia
        (años malos justo al inicio del retiro). Estimación educativa, no asesoramiento
        financiero.
      </footer>
    </div>
  );
}
