import { SITE } from "../siteConfig";
import { BrandMark } from "./BrandMark";
import { ThemeToggle } from "./ThemeToggle";

export function NavBar() {
  return (
    <header className="nav">
      <div className="nav-inner">
        <a className="brand" href="#top" aria-label={SITE.brand}>
          <span className="brand-mark">
            <BrandMark />
          </span>
          <span className="brand-name">{SITE.brand}</span>
        </a>

        <nav className="nav-links">
          <a href="#como-funciona">Cómo funciona</a>
          {SITE.repoUrl && (
            <a href={SITE.repoUrl} target="_blank" rel="noreferrer">
              Código
            </a>
          )}
          <a className="nav-cta" href="#calculadora">
            Calculadora
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
