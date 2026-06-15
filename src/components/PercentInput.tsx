import { useEffect, useState } from "react";

/**
 * Numeric input that displays and edits a value as a percentage (0.045 ↔ "4,5").
 * Keeps the text while the user types, so decimals aren't lost, and
 * resynchronizes if the value changes from the outside (presets, "Restablecer").
 */
export function PercentInput({
  value,
  onChange,
  step = 0.5,
  max = 100,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  max?: number;
  ariaLabel?: string;
}) {
  const fmt = (x: number) => String(Math.round(x * 1000) / 10);
  const [text, setText] = useState(() => fmt(value));

  useEffect(() => {
    const current = Number(text) / 100;
    if (!Number.isFinite(current) || Math.abs(current - value) > 1e-9) {
      setText(fmt(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="pct-input">
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={0}
        max={max}
        value={text}
        aria-label={ariaLabel}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(n)) onChange(n / 100);
        }}
      />
      <span>%</span>
    </div>
  );
}
