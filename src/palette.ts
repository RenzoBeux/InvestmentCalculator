/**
 * Colores de marca del gráfico, compartidos entre la pantalla (recharts) y el
 * PDF (jsPDF dibujado a mano). Mantener una sola fuente evita que las dos
 * superficies se desincronicen.
 *
 * Son `#rrggbb` planos a propósito: el parser `rgb()` del PDF los necesita así.
 */
export const CHART = {
  /** Fase de acumulación (azul). */
  accumulation: "#2B5B8A",
  /** Retiro que se sostiene o crece (verde). */
  grow: "#1E7A52",
  /** Retiro que se agota (rojo). */
  decline: "#B23A2E",
  /** Línea del número de retiro / objetivo (dorado). */
  target: "#B07D18",
} as const;
