import type { ReactNode } from "react";

/**
 * La matemática del modelo, en crudo. `HowItWorks` explica las *ideas*; esto
 * muestra las *fórmulas* exactas que corre `finance.ts`, una por una. Va
 * colapsado por defecto: el usuario casual no lo necesita, el curioso sí.
 *
 * Cada fórmula refleja una línea concreta de `computeLifecycle` / sus helpers.
 * Si tocás el modelo allá, actualizá la fórmula acá.
 */
interface Formula {
  name: string;
  /** La ecuación, con variables en cursiva (clase `var`). */
  expr: ReactNode;
  desc: string;
}

interface Group {
  label: string;
  formulas: Formula[];
}

const V = ({ children }: { children: ReactNode }) => <i className="fx-var">{children}</i>;

const GROUPS: Group[] = [
  {
    label: "El número",
    formulas: [
      {
        name: "Número de retiro",
        expr: (
          <>
            <V>número</V> = (<V>gasto mensual</V> × 12) ÷ <V>tasa de retiro</V>
          </>
        ),
        desc: "El capital que, a tu tasa de retiro, genera tu gasto anual a perpetuidad. A 4%, equivale a 25 veces tu gasto anual.",
      },
      {
        name: "Coast FIRE",
        expr: (
          <>
            <V>coast</V> = <V>número</V> ÷ (1 + <V>r</V>)
            <sup>
              <V>años</V>
            </sup>
          </>
        ),
        desc: "Cuánto necesitás hoy para que, sin aportar un peso más, el interés compuesto solo llegue al número en los años que te faltan para jubilarte.",
      },
    ],
  },
  {
    label: "Acumulación",
    formulas: [
      {
        name: "Capitalización mensual",
        expr: (
          <>
            <V>saldo</V>
            <sub>m+1</sub> = <V>saldo</V>
            <sub>m</sub> × (1 + <V>r</V> ÷ 12) + <V>aporte</V>
          </>
        ),
        desc: "Mes a mes: el saldo rinde una doceava parte del rendimiento anual y se le suma tu aporte. Repetido hasta llegar al número.",
      },
      {
        name: "Aporte creciente",
        expr: (
          <>
            <V>aporte</V>
            <sub>año+1</sub> = <V>aporte</V>
            <sub>año</sub> × (1 + <V>g</V>)
          </>
        ),
        desc: "Si configurás un crecimiento real g del aporte, sube ese porcentaje a fin de cada año (por encima de la inflación).",
      },
      {
        name: "Aportes vs. interés",
        expr: (
          <>
            <V>interés</V> = <V>saldo</V> − <V>aportes</V>
          </>
        ),
        desc: "Tu plata es lo que pusiste (inicial + aportes); el resto del saldo lo generó el interés compuesto. Es la barra de desglose.",
      },
      {
        name: "Auto-cálculo (despeje)",
        expr: (
          <>
            <V>aporte</V> = (<V>número</V> − <V>inicial</V> × (1 + <V>r</V> ÷ 12)
            <sup>
              <V>n</V>
            </sup>
            ) ÷ <V>F</V>
          </>
        ),
        desc: 'En los modos "Cuánto aportar" / "Inversión inicial", el saldo final (a n meses) es lineal en el valor a despejar, así que se resuelve exacto, sin tanteo. F acumula cada $1 de aporte —con su crecimiento g— hasta el final; la inversión inicial se despeja igual, contra su propio factor.',
      },
    ],
  },
  {
    label: "Retiro",
    formulas: [
      {
        name: "Evolución anual",
        expr: (
          <>
            <V>saldo</V>
            <sub>a+1</sub> = <V>saldo</V>
            <sub>a</sub> × (1 + <V>r</V>) − <V>gasto anual</V>
          </>
        ),
        desc: "Cada año la cartera rinde y vos retirás tu gasto. La diferencia entre rendir y gastar define si crece o se achica.",
      },
      {
        name: "Punto de equilibrio",
        expr: (
          <>
            <V>equilibrio</V> = <V>gasto anual</V> ÷ <V>r</V>
          </>
        ),
        desc: "El saldo donde el rendimiento empata exactamente el gasto. Por encima, la cartera crece sola; por debajo, se va agotando.",
      },
      {
        name: "Año de agotamiento",
        expr: (
          <>
            <V>años</V> = ln(<V>eq</V> ÷ (<V>eq</V> − <V>saldo</V>)) ÷ ln(1 + <V>r</V>)
          </>
        ),
        desc: "Si arrancás por debajo del equilibrio, este es el año en que el capital llega a cero. Por encima, nunca se agota.",
      },
    ],
  },
  {
    label: "Conversión",
    formulas: [
      {
        name: "Rendimiento real (Fisher)",
        expr: (
          <>
            <V>r</V>
            <sub>real</sub> = (1 + <V>r</V>
            <sub>nominal</sub>) ÷ (1 + <V>inflación</V>) − 1
          </>
        ),
        desc: "Todo el modelo trabaja en dólares de hoy. Si cargás rendimientos nominales, esta ecuación les descuenta la inflación.",
      },
    ],
  },
];

export function Formulas() {
  return (
    <section className="math" id="la-matematica">
      <div className="math-inner">
        <details className="math-details">
          <summary>
            <span className="math-summary-text">
              <span className="eyebrow">La matemática</span>
              <span className="math-summary-title">Las fórmulas, en crudo</span>
            </span>
            <span className="adv-chevron" aria-hidden="true">
              ›
            </span>
          </summary>

          <div className="math-body">
            <p className="math-intro">
              El modelo es determinista: estas son todas las ecuaciones que corre,
              sin nada escondido. <em>r</em> es siempre el rendimiento real anual.
            </p>

            {GROUPS.map((group) => (
              <div className="fx-group" key={group.label}>
                <h3 className="fx-group-label">{group.label}</h3>
                <div className="fx-list">
                  {group.formulas.map((f) => (
                    <article className="fx" key={f.name}>
                      <h4 className="fx-name">{f.name}</h4>
                      <p className="fx-expr">{f.expr}</p>
                      <p className="fx-desc">{f.desc}</p>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}
