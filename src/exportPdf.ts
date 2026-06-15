/**
 * Genera el PDF del plan con jsPDF: un reporte de una página, vectorial y
 * autocontenido (incluye el gráfico dibujado a mano, no una captura). Reemplaza
 * al viejo "imprimir la página", que salía como una web impresa.
 *
 * Paleta fija clara: el PDF siempre sale tinta oscura sobre papel, sin importar
 * el tema de la pantalla. jsPDF se importa de forma diferida (solo se descarga
 * cuando el usuario exporta), así no pesa en el bundle principal.
 */
import type { jsPDF } from "jspdf";
import {
  computeLifecycle,
  coastNumber,
  applySolve,
  ALLOCATION_LABELS,
  type LifecycleResult,
} from "./finance";
import {
  makeCurrencyFormatter,
  makeAxisFormatter,
  currencyByCode,
  formatPct,
} from "./format";
import type { PlanData } from "./exportData";
import { SITE } from "./siteConfig";
import { planFileName } from "./dateStamp";
import { CHART } from "./palette";
import { buildChartSeries } from "./chartSeries";
import { buildPlanSummary } from "./planSummary";

const INK = "#211D16";
const MUTED = "#6E665A";
const LINE = "#D8D1C2";
const ACCENT = CHART.grow;
const BLUE = CHART.accumulation;
const RED = CHART.decline;
const GOLD = CHART.target;
const CARD = "#FBF7EF";

type RGB = [number, number, number];
function rgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
const ink = (d: jsPDF, hex: string) => d.setTextColor(...rgb(hex));
const stroke = (d: jsPDF, hex: string) => d.setDrawColor(...rgb(hex));
const fill = (d: jsPDF, hex: string) => d.setFillColor(...rgb(hex));

export async function generatePlanPdf(plan: PlanData): Promise<void> {
  const { jsPDF: JsPDF } = await import("jspdf");
  const { currency, currentAge } = plan;
  // En los modos de auto-cálculo, inyectamos el valor despejado (aporte o
  // inicial) ANTES de simular, igual que la pantalla, para que el PDF y la app
  // muestren exactamente los mismos números.
  const { inputs, assumptions } = applySolve(
    plan.inputs,
    plan.assumptions,
    currentAge
  );
  const result = computeLifecycle(inputs, assumptions);

  const money = makeCurrencyFormatter(currency);
  const axisFmt = makeAxisFormatter(currency);
  const fmt = (n: number) => money.format(Math.round(n));

  const { ageMode, retirementAge, retirementSummary, verdict } = buildPlanSummary(
    result,
    inputs,
    assumptions,
    currentAge,
    { money: fmt, pct: formatPct },
    "pdf"
  );

  const coastApplies = ageMode && inputs.coastTargetAge > currentAge;
  const coast = coastNumber(
    result.fireNumber,
    result.accumulationReturn,
    inputs.coastTargetAge - currentAge
  );

  // ----------------------------------------------------------------- documento
  const doc = new JsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  const CW = W - M * 2;
  let y = M + 4;

  // Encabezado: marca (izq) y fecha (der), con una regla debajo.
  doc.setFont("times", "bold");
  doc.setFontSize(15);
  ink(doc, INK);
  doc.text(SITE.brand, M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  ink(doc, MUTED);
  const human = new Date().toLocaleDateString("es", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.text(`Plan de retiro · ${human}`, W - M, y, { align: "right" });
  y += 9;
  stroke(doc, INK);
  doc.setLineWidth(1.2);
  doc.line(M, y, W - M, y);
  y += 30;

  // Título + bajada.
  doc.setFont("times", "bold");
  doc.setFontSize(23);
  ink(doc, INK);
  doc.text("Tu plan de retiro", M, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  ink(doc, MUTED);
  const intro = doc.splitTextToSize(
    `Estimación en ${currencyByCode(
      currency
    ).label.toLowerCase()} de hoy (términos reales, inflación descontada). Modelo determinista, con fines educativos.`,
    CW
  );
  doc.text(intro, M, y);
  y += intro.length * 12 + 14;

  // Resultados: tres tarjetas.
  y = sectionTitle(doc, "Resultados", M, y, CW);
  const cards: [string, string][] = [
    ["Tu número de retiro", isFinite(result.fireNumber) ? fmt(result.fireNumber) : "—"],
    [
      result.reached ? (ageMode ? "Te jubilás" : "Años para llegar") : "Te jubilás",
      result.reached
        ? ageMode
          ? `${retirementAge} años`
          : `${result.accumulationYears}`
        : "—",
    ],
    ["En el retiro", retirementSummary],
  ];
  y = drawCards(doc, cards, M, y, CW);
  y += 14;

  // Veredicto en una caja tenue.
  const verdictLines = doc.splitTextToSize(verdict, CW - 24);
  const boxH = verdictLines.length * 12 + 18;
  fill(doc, CARD);
  stroke(doc, LINE);
  doc.setLineWidth(0.8);
  doc.roundedRect(M, y, CW, boxH, 7, 7, "FD");
  ink(doc, INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(verdictLines, M + 12, y + 15);
  y += boxH + 16;

  // Resultados secundarios: aportes vs. interés y Coast FIRE, en una línea tenue.
  const extras: string[] = [];
  if (result.reached && result.contributedAtFire + result.growthAtFire > 0) {
    extras.push(
      `Aportaste ${fmt(result.contributedAtFire)}; el interés generó ${fmt(
        Math.max(0, result.growthAtFire)
      )}.`
    );
  }
  if (coastApplies && isFinite(coast)) {
    extras.push(`Coast FIRE a los ${inputs.coastTargetAge}: ${fmt(coast)}.`);
  }
  if (extras.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    ink(doc, MUTED);
    const line = doc.splitTextToSize(extras.join(" "), CW);
    doc.text(line, M, y);
    y += line.length * 11 + 14;
  } else {
    y += 6;
  }

  // Dos columnas: Tus datos | Supuestos.
  const colGap = 28;
  const colW = (CW - colGap) / 2;
  const leftX = M;
  const rightX = M + colW + colGap;

  const datos: [string, string][] = [
    ["Edad actual", ageMode ? `${currentAge} años` : "—"],
    ...(inputs.solveFor !== "timeline" && ageMode
      ? ([
          ["Edad de jubilación objetivo", `${inputs.coastTargetAge} años`],
        ] as [string, string][])
      : []),
    [
      inputs.solveFor === "initial" ? "Inversión inicial (calculada)" : "Inversión inicial",
      fmt(inputs.initial),
    ],
    [
      inputs.solveFor === "monthly" ? "Aporte mensual (calculado)" : "Aporte mensual",
      fmt(inputs.monthly),
    ],
    ...(inputs.monthlyGrowth > 0
      ? ([
          ["Aumento del aporte", `${formatPct(inputs.monthlyGrowth)} real/año`],
        ] as [string, string][])
      : []),
    ["Gasto mensual hoy", fmt(inputs.monthlySpend)],
    ["Tasa de retiro", formatPct(inputs.withdrawalRate)],
    [
      "Cartera en el retiro",
      inputs.retirementAllocation === "custom"
        ? `Personalizada (~${formatPct(result.retirementReturn)})`
        : ALLOCATION_LABELS[inputs.retirementAllocation],
    ],
    ["Moneda", currencyByCode(currency).label],
  ];

  const nominal = assumptions.returnMode === "nominal";
  const supuestos: [string, string][] = [
    ["Rendimientos", nominal ? "Nominales" : "Reales"],
    ...(nominal
      ? ([["Inflación", formatPct(assumptions.inflation)]] as [string, string][])
      : []),
    ["Al acumular", `~${formatPct(result.accumulationReturn)} real`],
    ["En el retiro", `~${formatPct(result.retirementReturn)} real`],
    [
      "Horizonte de acumulación",
      `${assumptions.maxAccumulationYears} años`,
    ],
  ];

  const headY = y;
  let leftY = sectionTitle(doc, "Tus datos", leftX, headY, colW);
  let rightY = sectionTitle(doc, "Supuestos", rightX, headY, colW);
  leftY = drawList(doc, datos, leftX, leftY, colW);
  rightY = drawList(doc, supuestos, rightX, rightY, colW);
  y = Math.max(leftY, rightY) + 22;

  // Gráfico.
  y = sectionTitle(doc, "Proyección", M, y, CW);
  const chartH = Math.min(210, H - M - 56 - y);
  drawChart(doc, result, currentAge, ageMode, axisFmt, M, y, CW, chartH);

  // Pie: aviso.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  ink(doc, MUTED);
  const foot = doc.splitTextToSize(
    "Modelo determinista con rendimientos promedio: no incluye el riesgo de secuencia (años malos al inicio del retiro). Estimación educativa, no asesoramiento financiero.",
    CW
  );
  doc.text(foot, M, H - M - foot.length * 9);

  doc.save(planFileName("pdf"));
}

// ------------------------------------------------------------------- helpers ---

function sectionTitle(
  doc: jsPDF,
  label: string,
  x: number,
  y: number,
  w: number
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  ink(doc, ACCENT);
  doc.text(label.toUpperCase(), x, y, { charSpace: 0.8 });
  y += 6;
  stroke(doc, LINE);
  doc.setLineWidth(0.8);
  doc.line(x, y, x + w, y);
  return y + 17;
}

function drawCards(
  doc: jsPDF,
  cards: [string, string][],
  x: number,
  y: number,
  w: number
): number {
  const gap = 12;
  const cw = (w - gap * (cards.length - 1)) / cards.length;
  const ch = 60;
  cards.forEach(([label, value], i) => {
    const cx = x + i * (cw + gap);
    fill(doc, CARD);
    stroke(doc, LINE);
    doc.setLineWidth(0.8);
    doc.roundedRect(cx, y, cw, ch, 7, 7, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    ink(doc, MUTED);
    doc.text(label.toUpperCase(), cx + 12, y + 18, { charSpace: 0.5 });
    // El valor se achica si no entra en la tarjeta.
    let size = 15;
    doc.setFont("times", "bold");
    doc.setFontSize(size);
    while (doc.getTextWidth(value) > cw - 24 && size > 9) {
      size -= 0.5;
      doc.setFontSize(size);
    }
    ink(doc, INK);
    doc.text(value, cx + 12, y + 42);
  });
  return y + ch;
}

function drawList(
  doc: jsPDF,
  items: [string, string][],
  x: number,
  y: number,
  w: number
): number {
  const rowH = 19;
  items.forEach(([label, value], i) => {
    const ry = y + i * rowH;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    ink(doc, MUTED);
    doc.text(label, x, ry);
    doc.setFont("helvetica", "bold");
    ink(doc, INK);
    doc.text(value, x + w, ry, { align: "right" });
    stroke(doc, LINE);
    doc.setLineWidth(0.5);
    doc.line(x, ry + 6, x + w, ry + 6);
  });
  return y + items.length * rowH;
}

function drawChart(
  doc: jsPDF,
  result: LifecycleResult,
  currentAge: number,
  ageMode: boolean,
  axisFmt: (v: number) => string,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const series = buildChartSeries(result);
  const accYears = series.accYears;
  const totalYears = Math.max(1, series.totalYears);

  // Puntos (edad/año, valor) de cada fase.
  const acc: [number, number][] = series.accumulation.map(({ yearOffset, value }) => [
    currentAge + yearOffset,
    value,
  ]);
  const ret: [number, number][] = series.retirement.map(({ yearOffset, value }) => [
    currentAge + yearOffset,
    value,
  ]);

  const xMin = currentAge;
  const xMax = currentAge + totalYears;
  let yMax = result.fireNumber && isFinite(result.fireNumber) ? result.fireNumber : 0;
  for (const [, v] of [...acc, ...ret]) yMax = Math.max(yMax, v);
  yMax = yMax > 0 ? yMax * 1.08 : 1;

  // Área de ploteo (gutter izq. para etiquetas Y, gutter inf. para edades).
  const gx = 42;
  const gb = 26;
  const px0 = x + gx;
  const py0 = y;
  const pw = w - gx;
  const ph = h - gb;

  const px = (age: number) => px0 + ((age - xMin) / (xMax - xMin || 1)) * pw;
  const py = (val: number) => py0 + ph - (val / yMax) * ph;

  // Gridlines horizontales + etiquetas Y.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const val = (yMax / ySteps) * i;
    const yy = py(val);
    stroke(doc, LINE);
    doc.setLineWidth(0.5);
    doc.line(px0, yy, px0 + pw, yy);
    ink(doc, MUTED);
    doc.text(axisFmt(val), px0 - 6, yy + 2.5, { align: "right" });
  }

  // Eje X: etiquetas de cada tick (alineadas hacia adentro en los bordes).
  const xStep = Math.max(1, Math.round(totalYears / 7));
  doc.setFontSize(7.5);
  ink(doc, MUTED);
  for (let t = 0; t <= totalYears; t += xStep) {
    const xx = px(xMin + t);
    const align = t === 0 ? "left" : t + xStep > totalYears ? "right" : "center";
    doc.text(`${ageMode ? xMin + t : t}`, xx, py0 + ph + 11, { align });
  }
  // Nombre del eje, centrado en su propia línea para no pisar el último tick.
  doc.text(ageMode ? "Edad" : "Años desde hoy", px0 + pw / 2, py0 + ph + 22, {
    align: "center",
  });

  // Línea del número de retiro (objetivo), punteada.
  if (isFinite(result.fireNumber) && result.fireNumber <= yMax) {
    stroke(doc, GOLD);
    doc.setLineWidth(1);
    doc.setLineDashPattern([3, 3], 0);
    doc.line(px0, py(result.fireNumber), px0 + pw, py(result.fireNumber));
    doc.setLineDashPattern([], 0);
  }

  // Marca "te jubilás" (vertical punteada) si llega.
  if (result.reached) {
    const jx = px(currentAge + accYears);
    stroke(doc, MUTED);
    doc.setLineWidth(0.7);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(jx, py0, jx, py0 + ph);
    doc.setLineDashPattern([], 0);
    ink(doc, MUTED);
    doc.setFontSize(7.5);
    doc.text(
      ageMode ? `te jubilás · ${currentAge + accYears}` : "te jubilás",
      jx + 3,
      py0 + 8
    );
  }

  // Curva de acumulación (azul).
  drawPolyline(doc, acc.map(([a, v]) => [px(a), py(v)]), BLUE);
  // Curva de retiro (verde si dura, rojo si se agota).
  if (ret.length > 1) {
    drawPolyline(
      doc,
      ret.map(([a, v]) => [px(a), py(v)]),
      result.trend === "decline" ? RED : ACCENT
    );
  }

  // Marco inferior y eje.
  stroke(doc, LINE);
  doc.setLineWidth(0.8);
  doc.line(px0, py0 + ph, px0 + pw, py0 + ph);
}

function drawPolyline(doc: jsPDF, pts: [number, number][], hex: string): void {
  if (pts.length < 2) return;
  stroke(doc, hex);
  doc.setLineWidth(1.6);
  for (let i = 1; i < pts.length; i++) {
    doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
  }
}
