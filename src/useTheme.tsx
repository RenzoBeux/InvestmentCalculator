/**
 * App theme: light / dark / system, with persistence.
 *
 * The `data-theme` attribute on <html> is the source of truth for the CSS (see the
 * tokens block in styles.css). Recharts doesn't read CSS variables, so the
 * context also exposes an already-resolved `dark` boolean for the chart's
 * colors. A single <ThemeProvider> in App keeps everything in sync: the nav
 * toggle and the chart read the same state.
 *
 * The initial flash (FOUC) is prevented by an inline script in index.html that sets
 * `data-theme` before the first paint; this effect only keeps it up to date.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePersistedState } from "./usePersistedState";

export type ThemeChoice = "light" | "dark" | "system";

interface ThemeContextValue {
  choice: ThemeChoice;
  setChoice: (choice: ThemeChoice) => void;
  /** Resolved dark (resolves "system" against the operating system). */
  dark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const META_LIGHT = "#f6f2e9";
const META_DARK = "#15130e";

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = usePersistedState<ThemeChoice>(
    "fire.theme",
    "system"
  );
  // In "system" mode we follow the system's change live.
  const [systemDark, setSystemDark] = useState(prefersDark);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const dark = choice === "system" ? systemDark : choice === "dark";

  useEffect(() => {
    // We reflect the RESOLVED value (not the choice): this way the CSS only needs
    // `:root` and `:root[data-theme="dark"]`, without duplicating the dark tokens in
    // a media query. The "system" mode follows the system via `systemDark`.
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? META_DARK : META_LIGHT);
  }, [dark]);

  const value = useMemo(
    () => ({ choice, setChoice, dark }),
    [choice, setChoice, dark]
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}
