/**
 * Read-only field that displays a value the calculator solved for (the monthly
 * contribution or the initial investment) instead of an editable input. Used in
 * the auto-calc modes: the user fixes the target retirement age and this field
 * is computed automatically. `ok` distinguishes a valid result from an error
 * message (impossible target or the age has not been loaded yet).
 */
interface Props {
  label: string;
  ok: boolean;
  /** The already-formatted value (e.g. "US$1.240 / mes") or "—" if not applicable. */
  display: string;
  /** Clarification below the value: "para jubilarte a los 45" or the error message. */
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
