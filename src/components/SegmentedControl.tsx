/**
 * Grupo de botones de selección única (un "radio group" estilado). Reemplaza los
 * `<div className="seg">` armados a mano y agrega la semántica de accesibilidad
 * (role="radiogroup" / role="radio" / aria-checked) que los botones sueltos no
 * tenían. Emite las mismas clases, así el CSS no cambia.
 */
interface Option<T> {
  value: T;
  label: string;
}

interface Props<T extends string | number> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Por defecto compara contra `value`; pasá esto para una lógica de activo a medida. */
  isActive?: (value: T) => boolean;
  ariaLabel: string;
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  isActive,
  ariaLabel,
}: Props<T>) {
  return (
    <div className="seg" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => {
        const active = isActive ? isActive(o.value) : o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            className={active ? "active" : ""}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
