import { SITE } from "../siteConfig";
import { BrandMark } from "./BrandMark";
import { GitHubIcon } from "./GitHubIcon";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="brand-mark">
            <BrandMark />
          </span>
          <div>
            <strong>{SITE.brand}</strong>
            <p>{SITE.tagline}.</p>
          </div>
        </div>

        <nav className="footer-links">
          <a href="#calculadora">Calculadora</a>
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
        </nav>
      </div>

      <div className="footer-fine">
        <p>
          Modelo determinista con rendimientos promedio: no incluye el riesgo de
          secuencia (años malos justo al inicio del retiro). Estimación educativa,
          no asesoramiento financiero.
        </p>
        <p>© {year} {SITE.brand}</p>
      </div>
    </footer>
  );
}
