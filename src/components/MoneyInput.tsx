import { useEffect, useState } from "react";

/**
 * Money input with a currency-symbol prefix. Keeps the raw text the user types
 * in internal state, so a zero value renders as an empty field instead of a
 * literal "0" that the user ends up typing in front of (the stuck leading
 * zero). A leading zero typed in front of real digits ("05") is also stripped
 * on the keystroke. Resyncs when the value changes from the outside (presets,
 * reset, shared links), mirroring PercentInput.
 */
export function MoneyInput({
  value,
  onChange,
  symbol,
  step = 100,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  symbol: string;
  step?: number;
  ariaLabel?: string;
}) {
  // A zero amount shows as empty (placeholder territory), not "0".
  const fmt = (x: number) => (x === 0 ? "" : String(x));
  const [text, setText] = useState(() => fmt(value));

  useEffect(() => {
    const current = text === "" ? 0 : Number(text);
    if (!Number.isFinite(current) || current !== value) {
      setText(fmt(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="money">
      <span>{symbol}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={step}
        value={text}
        aria-label={ariaLabel}
        onChange={(e) => {
          // Drop a zero typed in front of real digits ("05" -> "5"); a lone "0"
          // and decimals like "0.5" are kept (the lookahead needs a digit next).
          const raw = e.target.value.replace(/^0+(?=\d)/, "");
          setText(raw);
          if (raw === "") {
            onChange(0);
            return;
          }
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </div>
  );
}
