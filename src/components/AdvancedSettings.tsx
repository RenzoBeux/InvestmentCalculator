import { type Dispatch, type SetStateAction } from "react";
import {
  ALLOCATIONS,
  ALLOCATION_LABELS,
  type PresetAllocation,
  type Assumptions,
} from "../finance";
import { CURRENCIES } from "../format";
import { PercentInput } from "./PercentInput";

interface Props {
  assumptions: Assumptions;
  setAssumptions: Dispatch<SetStateAction<Assumptions>>;
  currency: string;
  setCurrency: (code: string) => void;
  onReset: () => void;
}

export function AdvancedSettings({
  assumptions,
  setAssumptions,
  currency,
  setCurrency,
  onReset,
}: Props) {
  function patch<K extends keyof Assumptions>(key: K, val: Assumptions[K]) {
    setAssumptions((prev) => ({ ...prev, [key]: val }));
  }

  function setRetReturn(alloc: PresetAllocation, val: number) {
    setAssumptions((prev) => ({
      ...prev,
      retirementReturns: { ...prev.retirementReturns, [alloc]: val },
    }));
  }

  const nominal = assumptions.returnMode === "nominal";

  return (
    <details className="advanced">
      <summary>
        <span className="adv-title">Ajustes avanzados</span>
        <span className="adv-hint">moneda, rendimientos, inflación, horizonte</span>
        <span className="adv-chevron" aria-hidden>
          ›
        </span>
      </summary>

      <div className="advanced-body">
        <div className="adv-grid">
          <div className="field">
            <label htmlFor="currency">Moneda</label>
            <select
              id="currency"
              className="select"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label} ({c.symbol})
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Cómo ingresás los rendimientos</label>
            <div className="seg">
              <button
                className={!nominal ? "active" : ""}
                onClick={() => patch("returnMode", "real")}
              >
                Reales
              </button>
              <button
                className={nominal ? "active" : ""}
                onClick={() => patch("returnMode", "nominal")}
              >
                Nominales
              </button>
            </div>
            <small>
              {nominal
                ? "Cargás rendimientos nominales y restamos la inflación."
                : "Rendimientos ya ajustados por inflación (recomendado)."}
            </small>
          </div>

          {nominal && (
            <div className="field">
              <label>Inflación anual</label>
              <PercentInput
                value={assumptions.inflation}
                onChange={(v) => patch("inflation", v)}
                step={0.5}
              />
              <small>Se descuenta de cada rendimiento nominal.</small>
            </div>
          )}

          <div className="field">
            <label>Rendimiento al acumular</label>
            <PercentInput
              value={assumptions.accumulationReturn}
              onChange={(v) => patch("accumulationReturn", v)}
            />
            <small>{nominal ? "Nominal" : "Real"}, durante la fase de aportes.</small>
          </div>

          <div className="field adv-span">
            <label>Rendimiento en el retiro, por cartera</label>
            <div className="ret-returns">
              {ALLOCATIONS.map((a) => (
                <div className="ret-return" key={a}>
                  <span>{ALLOCATION_LABELS[a]}</span>
                  <PercentInput
                    value={assumptions.retirementReturns[a]}
                    onChange={(v) => setRetReturn(a, v)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="maxYears">Horizonte de acumulación</label>
            <div className="years-input">
              <input
                id="maxYears"
                type="number"
                min={5}
                max={100}
                step={1}
                value={assumptions.maxAccumulationYears}
                onChange={(e) =>
                  patch("maxAccumulationYears", Math.max(1, Number(e.target.value)))
                }
              />
              <span>años</span>
            </div>
            <small>Hasta cuándo simulamos los aportes.</small>
          </div>

          <div className="field">
            <label htmlFor="chartYears">Proyección del retiro</label>
            <div className="years-input">
              <input
                id="chartYears"
                type="number"
                min={5}
                max={100}
                step={1}
                value={assumptions.retirementChartYears}
                onChange={(e) =>
                  patch("retirementChartYears", Math.max(1, Number(e.target.value)))
                }
              />
              <span>años</span>
            </div>
            <small>Cuántos años de retiro grafica.</small>
          </div>
        </div>

        <div className="adv-actions">
          <button className="btn-reset" onClick={onReset}>
            Restablecer valores por defecto
          </button>
        </div>
      </div>
    </details>
  );
}
