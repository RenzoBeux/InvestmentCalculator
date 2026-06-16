/**
 * Chart brand colors, shared between the screen (recharts) and the
 * PDF (hand-drawn jsPDF). Keeping a single source prevents the two
 * surfaces from drifting out of sync.
 *
 * They are flat `#rrggbb` on purpose: the PDF's `rgb()` parser needs them that way.
 */
export const CHART = {
  /** Accumulation phase (blue). */
  accumulation: "#2B5B8A",
  /** Retirement that holds steady or grows (green). */
  grow: "#1E7A52",
  /** Retirement that depletes (red). */
  decline: "#B23A2E",
  /** Retirement number / target line (gold). */
  target: "#B07D18",
  /** Coast FIRE "ghost" trajectory: coasting to the target without contributing (muted slate). */
  coast: "#6E7E99",
} as const;
