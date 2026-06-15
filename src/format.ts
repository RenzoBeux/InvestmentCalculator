/**
 * Currency and percentage formatting.
 *
 * The app is multi-currency: the user picks one and all amounts are shown
 * with the corresponding symbol and local convention. Add currencies to
 * `CURRENCIES` without touching the rest of the app.
 */

export interface CurrencyOption {
  /** ISO 4217 code. */
  code: string;
  /** Short symbol to prefix inputs (e.g. "US$"). */
  symbol: string;
  /** Human-readable name. */
  label: string;
  /** Locale for Intl.NumberFormat. */
  locale: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: "USD", symbol: "US$", label: "Dólar estadounidense", locale: "en-US" },
  { code: "EUR", symbol: "€", label: "Euro", locale: "de-DE" },
  { code: "GBP", symbol: "£", label: "Libra esterlina", locale: "en-GB" },
  { code: "ARS", symbol: "AR$", label: "Peso argentino", locale: "es-AR" },
  { code: "MXN", symbol: "MX$", label: "Peso mexicano", locale: "es-MX" },
  { code: "BRL", symbol: "R$", label: "Real brasileño", locale: "pt-BR" },
  { code: "CLP", symbol: "CLP$", label: "Peso chileno", locale: "es-CL" },
  { code: "UYU", symbol: "$U", label: "Peso uruguayo", locale: "es-UY" },
];

export const DEFAULT_CURRENCY = "USD";

export function currencyByCode(code: string): CurrencyOption {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

/** Builds a currency formatter without decimals for the given code. */
export function makeCurrencyFormatter(code: string): Intl.NumberFormat {
  const c = currencyByCode(code);
  return new Intl.NumberFormat(c.locale, {
    style: "currency",
    currency: c.code,
    maximumFractionDigits: 0,
  });
}

/** Short labels for the chart axis (e.g. "$1,2M", "$340k"). */
export function makeAxisFormatter(code: string): (v: number) => string {
  const sym = currencyByCode(code).symbol;
  const prefix = sym.endsWith("$") || sym.length <= 2 ? sym : sym + " ";
  const fmt = (n: number) => n.toLocaleString(currencyByCode(code).locale);
  return (v: number) =>
    v >= 1e6
      ? `${prefix}${(v / 1e6).toFixed(1).replace(".", ",")}M`
      : v >= 1000
      ? `${prefix}${Math.round(v / 1000)}k`
      : `${prefix}${fmt(v)}`;
}

/** Percentage in Spanish local format: 0.045 → "4,5%". */
export function formatPct(x: number, decimals = 1): string {
  const v = x * 100;
  const s = Number.isInteger(v) ? String(v) : v.toFixed(decimals);
  return s.replace(".", ",") + "%";
}
