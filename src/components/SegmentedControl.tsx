/**
 * Single-select button group (a styled "radio group"). Replaces the
 * hand-rolled `<div className="seg">` markup and adds the accessibility semantics
 * (role="radiogroup" / role="radio" / aria-checked) that the bare buttons didn't
 * have. Emits the same classes, so the CSS doesn't change.
 */
interface Option<T> {
  value: T;
  label: string;
}

interface Props<T extends string | number> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Defaults to comparing against `value`; pass this for custom active logic. */
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
