/**
 * Campo de solo lectura que muestra un valor que la calculadora despejó (el
 * aporte mensual o la inversión inicial) en lugar de un input editable. Se usa
 * en los modos de auto-cálculo: el usuario fija la edad de jubilación objetivo y
 * este campo se calcula solo. `ok` distingue un resultado válido de un mensaje
 * de error (objetivo imposible o falta cargar la edad).
 */
interface Props {
  label: string;
  ok: boolean;
  /** El valor ya formateado (p. ej. "US$1.240 / mes") o "—" si no aplica. */
  display: string;
  /** Aclaración bajo el valor: "para jubilarte a los 45" o el mensaje de error. */
  note: string;
}

export function SolvedField({ label, ok, display, note }: Props) {
  return (
    <div className="field">
      <label>
        <span>{label}</span>
        <span className="solved-pill">calculado</span>
      </label>
      <div
        className={ok ? "solved-value" : "solved-value is-empty"}
        aria-live="polite"
      >
        {display}
      </div>
      {note && <small>{note}</small>}
    </div>
  );
}
