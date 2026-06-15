/**
 * Tema de la app: claro / oscuro / sistema, con persistencia.
 *
 * El atributo `data-theme` en <html> es la fuente de verdad para el CSS (ver el
 * bloque de tokens en styles.css). Recharts no lee variables CSS, así que el
 * contexto también expone un booleano `dark` ya resuelto para los colores del
 * gráfico. Un único <ThemeProvider> en App mantiene todo sincronizado: el toggle
 * del nav y el gráfico leen el mismo estado.
 *
 * El parpadeo inicial (FOUC) lo evita un script inline en index.html que setea
 * `data-theme` antes del primer pintado; este efecto solo lo mantiene al día.
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
  /** Oscuro resuelto (resuelve "system" contra el sistema operativo). */
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
  // En modo "system" seguimos el cambio del sistema en vivo.
  const [systemDark, setSystemDark] = useState(prefersDark);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const dark = choice === "system" ? systemDark : choice === "dark";

  useEffect(() => {
    // Reflejamos el valor RESUELTO (no la elección): así el CSS solo necesita
    // `:root` y `:root[data-theme="dark"]`, sin duplicar los tokens oscuros en
    // una media query. El modo "system" sigue al sistema vía `systemDark`.
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
