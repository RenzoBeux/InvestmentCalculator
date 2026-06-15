/**
 * Formato de moneda y porcentajes.
 *
 * La app es multi-moneda: el usuario elige una y todos los importes se muestran
 * con el símbolo y la convención local correspondientes. Sumá monedas a
 * `CURRENCIES` sin tocar el resto de la app.
 */

export interface CurrencyOption {
  /** Código ISO 4217. */
  code: string;
  /** Símbolo corto para prefijar inputs (p. ej. "US$"). */
  symbol: string;
  /** Nombre legible. */
  label: string;
  /** Locale para Intl.NumberFormat. */
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
];

export const DEFAULT_CURRENCY = "USD";

export function currencyByCode(code: string): CurrencyOption {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

/** Construye un formateador de moneda sin decimales para el código dado. */
export function makeCurrencyFormatter(code: string): Intl.NumberFormat {
  const c = currencyByCode(code);
  return new Intl.NumberFormat(c.locale, {
    style: "currency",
    currency: c.code,
    maximumFractionDigits: 0,
  });
}

/** Etiquetas cortas para el eje del gráfico (p. ej. "$1,2M", "$340k"). */
export function makeAxisFormatter(code: string): (v: number) => string {
  const sym = currencyByCode(code).symbol.replace(/\$$/, "$");
  const prefix = sym.endsWith("$") || sym.length <= 2 ? sym : sym + " ";
  const fmt = (n: number) => n.toLocaleString(currencyByCode(code).locale);
  return (v: number) =>
    v >= 1e6
      ? `${prefix}${(v / 1e6).toFixed(1).replace(".", ",")}M`
      : v >= 1000
      ? `${prefix}${Math.round(v / 1000)}k`
      : `${prefix}${fmt(v)}`;
}

/** Porcentaje en formato local español: 0.045 → "4,5%". */
export function formatPct(x: number, decimals = 1): string {
  const v = x * 100;
  const s = Number.isInteger(v) ? String(v) : v.toFixed(decimals);
  return s.replace(".", ",") + "%";
}
