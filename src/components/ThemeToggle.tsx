/**
 * Theme selector in the nav: light / dark / system. Three icon buttons
 * (an accessible radiogroup). Reads from and writes to the theme context.
 */
import { type ReactNode } from "react";
import { useTheme, type ThemeChoice } from "../useTheme";

const ICON_PROPS = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function SunIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

const OPTIONS: { value: ThemeChoice; label: string; icon: ReactNode }[] = [
  { value: "light", label: "Tema claro", icon: <SunIcon /> },
  { value: "dark", label: "Tema oscuro", icon: <MoonIcon /> },
  { value: "system", label: "Según el sistema", icon: <SystemIcon /> },
];

export function ThemeToggle() {
  const { choice, setChoice } = useTheme();
  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Tema">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={choice === o.value}
          aria-label={o.label}
          title={o.label}
          className={choice === o.value ? "active" : ""}
          onClick={() => setChoice(o.value)}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
