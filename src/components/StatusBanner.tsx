/**
 * Plan status banner (ok / bad / warn). Adds an icon per status, so the
 * meaning doesn't depend on color alone (accessible for color blindness), plus an
 * `aria-live` so it's announced when it changes as the inputs are edited.
 */
import { type ReactNode } from "react";
import { type StatusKind } from "../planSummary";

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const ICONS: Record<StatusKind, ReactNode> = {
  ok: (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  ),
  warn: (
    <svg {...ICON_PROPS}>
      <path d="M12 3 2.5 19.5h19L12 3z" />
      <path d="M12 10v4M12 17.5v.01" />
    </svg>
  ),
  bad: (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </svg>
  ),
};

export function StatusBanner({
  kind,
  children,
}: {
  kind: StatusKind;
  children: ReactNode;
}) {
  return (
    <div className={`status ${kind}`} role="status" aria-live="polite">
      <span className="status-icon" aria-hidden>
        {ICONS[kind]}
      </span>
      <span>{children}</span>
    </div>
  );
}
