/**
 * Grupo segmentado con presets + una opción "Personalizada" que revela un input
 * (el rendimiento o la tasa a mano). El estado activo lo maneja el padre: la
 * tasa de retiro usa un booleano aparte, mientras que la cartera "custom" es un
 * valor real del enum. Mantener este componente "tonto" evita una abstracción
 * con fugas. Emite las mismas clases `.seg`/`.custom-rate`, así el CSS no cambia.
 */
import { type ReactNode } from "react";

interface Option<T> {
  value: T;
  label: string;
}

interface Props<T extends string | number> {
  options: Option<T>[];
  /** ¿El preset con este valor está activo? (false cuando se está en modo personalizado). */
  isPresetActive: (value: T) => boolean;
  onSelectPreset: (value: T) => void;
  customActive: boolean;
  onSelectCustom: () => void;
  customLabel?: string;
  ariaLabel: string;
  /** El input personalizado; se muestra solo cuando `customActive`. */
  children?: ReactNode;
}

export function SegmentedWithCustom<T extends string | number>({
  options,
  isPresetActive,
  onSelectPreset,
  customActive,
  onSelectCustom,
  customLabel = "Personalizada",
  ariaLabel,
  children,
}: Props<T>) {
  return (
    <div className="seg" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => {
        const active = isPresetActive(o.value);
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            className={active ? "active" : ""}
            onClick={() => onSelectPreset(o.value)}
          >
            {o.label}
          </button>
        );
      })}
      <div className="custom-rate">
        <button
          type="button"
          role="radio"
          aria-checked={customActive}
          className={customActive ? "active" : ""}
          onClick={onSelectCustom}
        >
          {customLabel}
        </button>
        {customActive && children}
      </div>
    </div>
  );
}
