/**
 * Segmented group with presets + a "Personalizada" option that reveals an input
 * (the return or the rate, entered by hand). The active state is managed by the
 * parent: the withdrawal rate uses a separate boolean, whereas the "custom"
 * portfolio is an actual enum value. Keeping this component "dumb" avoids a
 * leaky abstraction. It emits the same `.seg`/`.custom-rate` classes, so the CSS doesn't change.
 */
import { type ReactNode } from "react";

interface Option<T> {
  value: T;
  label: string;
}

interface Props<T extends string | number> {
  options: Option<T>[];
  /** Is the preset with this value active? (false when in custom mode). */
  isPresetActive: (value: T) => boolean;
  onSelectPreset: (value: T) => void;
  customActive: boolean;
  onSelectCustom: () => void;
  customLabel?: string;
  ariaLabel: string;
  /** The custom input; shown only when `customActive`. */
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
