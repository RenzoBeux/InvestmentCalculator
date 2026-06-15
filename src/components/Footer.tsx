import { SITE } from "../siteConfig";
import { BrandMark } from "./BrandMark";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="brand-mark">
            <BrandMark size={20} />
          </span>
          <div>
            <strong>{SITE.brand}</strong>
            <p>{SITE.tagline}.</p>
          </div>
        </div>

        <nav className="footer-links">
          <a href="#calculadora">Calculadora</a>
          <a href="#como-funciona">Cómo funciona</a>
          {SITE.repoUrl && (
            <a href={SITE.repoUrl} target="_blank" rel="noreferrer">
              Código fuente
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
