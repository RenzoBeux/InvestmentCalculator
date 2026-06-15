import { SITE } from "../siteConfig";
import { BrandMark } from "./BrandMark";
import { GitHubIcon } from "./GitHubIcon";
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
          <a href={SITE.authorUrl} target="_blank" rel="noreferrer">
            renzobeux.dev
          </a>
          {SITE.repoUrl && (
            <a
              className="icon-link"
              href={SITE.repoUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Código fuente en GitHub"
              title="Código fuente en GitHub"
            >
              <GitHubIcon />
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
